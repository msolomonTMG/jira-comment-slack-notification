'use strict';
const
  express = require('express'),
  exphbs = require('express-handlebars'),
  bodyParser = require('body-parser'),
  slack = require('./slack'),
  user = require('./user'),
  jira = require('./jira'),
  utils = require('./utils'),
  passport = require('passport'),
  AtlassianOAuthStrategy = require('passport-atlassian-oauth').Strategy,
  request = require('request'),
  mongoose = require('mongoose'),
  APP_URL = process.env.APP_URL || `http://localhost:5000/`,
  JIRA_URL = process.env.JIRA_URL,
  MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/mongo_test";

let privateKey = Buffer.from(process.env.RSA_PRIVATE_KEY, 'base64').toString();

mongoose.connect(MONGO_URI, function (err, res) {
  if (err) {
  console.log ('ERROR connecting to: ' + MONGO_URI + '. ' + err);
  } else {
  console.log ('Succeeded connected to: ' + MONGO_URI);
  }
});

var app = express();
app.set('port', process.env.PORT || 5000);

app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());
app.use(passport.initialize());
app.use(passport.session());
app.use(require('express-session')({ secret: 'keyboard cat', resave: true, saveUninitialized: true }));

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

app.engine('handlebars', exphbs({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');

app.get('/signup', function(req, res) {
  res.render('signup');
})

// passport setup for atlassian
// called from route: /auth/atlassian-oauth
passport.use(new AtlassianOAuthStrategy({
  applicationURL: `${JIRA_URL}`,
  callbackURL:`${APP_URL}auth/atlassian-oauth/callback`,
  passReqToCallback: true,
  consumerKey:"neptune-the-dodle",
  consumerSecret:privateKey
}, function(req, token, tokenSecret, profile, done) {
    console.log('HELLO')
    process.nextTick(function() {
      console.log(token)
      console.log(tokenSecret)
      console.log(req.session.slackUsername)

      // check if this user is just adding a jira token
      // or if they are a brand new user
      user.getBySlackUsername(req.session.slackUsername).then(thisUser => {
        if (!thisUser) {
          user.create({
            slackUsername: req.session.slackUsername,
            jiraToken: token,
            jiraUsername: profile.username,
            jiraTokenSecret: tokenSecret
          }).then(createdUser => {
            return done(null, createdUser)
          })
        } else {
          console.log('updating user')
          user.getBySlackUsername(req.session.slackUsername).then(thisUser => {
            user.update(thisUser._id, {
              jiraToken: token,
              jiraTokenSecret: tokenSecret,
              jiraUsername: utils.addJiraMarkupToUsername(profile.username)
            }).then(updatedUser => {
              console.log(updatedUser)
              return done(null, updatedUser)
            })
          })
        }
      })
      
    })
  }
));

app.get('/auth', function(req, res) {
  console.log('AUTH')
  console.log(privateKey)
  user.getBySlackUsername(req.query.slackUsername)
    .then(thisUser => {
      if (thisUser) {
        // save slack username to session to use when saving user after auth
        req.session.slackUsername = req.query.slackUsername
        // send to auth route
        res.redirect('/auth/atlassian-oauth')

      } else {
        // this user already signed up
        res.send(JSON.stringify({user: thisUser}))
      }
    })
})

// auth route uses passport
app.get('/auth/atlassian-oauth',
    passport.authenticate('atlassian-oauth'),
    function (req, res) {
      console.log('ATLASSIAN AUTH')
      res.render('message', {
        successMsg: 'yay!'
      })
        // The request will be redirected to the Atlassian app for authentication, so this
        // function will not be called.
    })

app.get('/auth/atlassian-oauth/callback',
    passport.authenticate('atlassian-oauth', { failureRedirect:'/fail' }),
    function (req, res) {
      console.log('req')
      console.log(req)
      console.log("ATLASSIAN AUTH CALLBACK")
      if (req.session.passport.user.jiraToken && req.session.passport.user.jiraTokenSecret) {
        slack.sendMessageToUser(req.session.passport.user.slackUsername, `:+1: Nice work, you're all set. Going forward, you'll have the option to respond to Jira comments from here!`)
      }
      res.redirect('/?success=true');
    })

app.get('/auth/atlassian-oauth/authorize', function(req, res) {
  console.log('AUTH URL')
  console.log(req.body)
  res.sendStatus(200)
})

app.get('/delete', function(req, res) {  
  user.deleteMike().then(success => {
    res.send(success)
  })
})

app.get('/deleteToken', function(req, res) {
  user.deleteMikeToken().then(success => {
    res.send({success})
  }).catch(err => {
    res.send({err})
  })
})


app.get('/', function(req, res) {

  if (req.query.success) {
    res.render('message', {
      successMsg: 'You can now receive and respond to Jira comments from within Slack!'
    })
  } else {
    res.render('home')
  }

})

app.get('/settings', function(req, res) {
  if (!req.query.slackUsername) {
    res.send(403)
  }
  user.getBySlackUsername(req.query.slackUsername).then(thisUser => {
    console.log(thisUser)
    if (!thisUser) {
      res.sendStatus(403)
    }
    res.render('settings', {
      slackUsername: thisUser.slackUsername,
      jiraUsername: utils.stripJiraMarkupFromUsername(thisUser.jiraUsername)
    })
  }).catch(err => {
    res.sendStatus(403)
  })
})

app.post('/response-from-slack', function(req, res) {
  console.log(req.body)
  if (req.body.challenge) {
    res.send(req.body.challenge)
  } else if (req.body.payload) {

    let payload = JSON.parse(req.body.payload)
    console.log("PAYLOAD")
    console.log(payload)

    if (payload.callback_id == 'pop_comment_dialog') {
      // give slack a response right away
      res.status(200).send(JSON.stringify({
        replace_original: false
      }))
      console.log(payload.user.name)
      user.getBySlackUsername(payload.user.name).then(thisUser => {
        console.log(thisUser)
        if (!thisUser) {
          console.log('there is no user')
          slack.sendSettingsToUser(thisUser)
        } else if (!thisUser.jiraToken || !thisUser.jiraTokenSecret) {
          
          console.log('no tokens!!')
          // this shouldnt happen because we pop auth buttons instead
          // of popping respond to comment buttons if no tokens
          
        } else {
          slack.openCommentDialog(payload).then(success => {
            console.log(success)
          })
        }

        //slack.popDialog(thisUser)

      })
    } else if (payload.callback_id.match(/create_comment/)) {
      user.getBySlackUsername(payload.user.name).then(thisUser => {
        console.log(thisUser)
        console.log(payload)
        console.log(payload.callback_id)
        let issueKey = payload.callback_id.split('|')[1]
        let comment = payload.submission.comment
        
        jira.createComment(thisUser, issueKey, comment).then(success => {
          console.log('SUCCESS')
          console.log(success)
          // slack will post OK in the channel if you just return 200
          slack.sendMessageToUser(thisUser.slackUsername, ':white_check_mark: Your comment has been made in Jira')
          res.setHeader('Content-Type', 'application/json');
          res.status(200).send()
        })
      })
    }

  }

    // user.getBySlackUserId(req.body.event.user).then(thisUser => {
    //
    //   res.send(200)
    //
    // })

})

app.get('/user/create', function(req, res) {
  user.getBySlackUsername(req.query.slackUsername).then(thisUser => {
    if(thisUser == null) {
      user.create({
        slackUsername: req.query.slackUsername
      }).then(createdUser => {
        console.log('CREATED A USER')
        console.log(createdUser)
        res.redirect(`/auth?slackUsername=${createdUser.slackUsername}`)
      })
    } else {
      console.log('there is a user')
      console.log(thisUser)
    }
  }).catch(err => {
    console.log(err)
  })
})

app.post('/user/create', function(req, res) {
  let newUser = {
    slackUsername: req.body.slack.username,
    slackUserId: req.body.slackUserId,
    jiraUsername: req.body.jira.username
  }
  user.create(newUser).then(createdUser => {
    return res.render('settings', {
      slackUsername: createdUser.slackUsername,
      slackUserId: createdUser.slackUserId,
      jiraUsername: utils.stripJiraMarkupFromUsername(createdUser.jiraUsername),
      signUpSuccessMsg: 'Signup Successful!'
    })
  })
})

app.post('/msg-wake-up', function(req, res) {
  if (req.body.challenge) {
    res.send(req.body.challenge)
  } else {
    //wake up!
    console.log('Im up!')
    res.send(200)
  }
})

app.post('/comment-created', function(req, res) {
  let webhookReason = req.body.webhookEvent,
      webhookData = req.body,
      commentBody = req.body.comment.body;

  // continue if the webhook was sent to us because an issue was commented on
  // by someone other than our GitHub Integration
  if (webhookReason === "comment_created" && webhookData.comment.author.displayName != "GitHub Integration") {
    // look for a user mention in the comment
    utils.getUserMentionsFromComment(commentBody).then(userMentions => {
      // for each mentioned user thats signed up for this app, send slack msg
      userMentions.forEach(userMention => {
        // find if there is a user with that jira username in this app's DB
        user.getByJiraUsername(userMention).then((thisUser, index) => {
          // send a slack message to the user
          slack.sendCommentToUser(thisUser, webhookData).then(result => {
            // if this is the last user to msg, send 200 status
            if (userMentions.length === index + 1) {
              res.sendStatus(200)
            }
          })
          .catch(err => { return res.sendStatus(500) })

        })
        .catch(noUser => { return res.sendStatus(200) })

      })

    })
    .catch(noMentions => { return res.sendStatus(200) })
  }

})

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
module.exports = app;
