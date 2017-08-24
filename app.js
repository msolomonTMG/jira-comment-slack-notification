'use strict';

const
  express = require('express'),
  exphbs = require('express-handlebars'),
  bodyParser = require('body-parser'),
  slack = require('./slack'),
  user = require('./user'),
  utils = require('./utils'),
  request = require('request'),
  mongoose = require('mongoose'),
  MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/mongo_test";

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

app.engine('handlebars', exphbs({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');

app.get('/signup', function(req, res) {
  res.render('signup');
})

app.get('/settings', function(req, res) {
  if (!req.query.slackUsername) {
    res.send(403)
  }
  user.getBySlackUsername(req.query.slackUsername).then(thisUser => {
    console.log(thisUser)
    res.render('settings', {
      slackUsername: thisUser.slackUsername,
      jiraUsername: utils.stripJiraMarkupFromUsername(thisUser.jiraUsername)
    })
  }).catch(err => {
    res.sendStatus(403)
  })
})

app.post('/user/create', function(req, res) {
  let newUser = {
    slackUsername: req.body.slack.username,
    jiraUsername: req.body.jira.username
  }
  user.create(newUser).then(createdUser => {
    return res.render('settings', {
      slackUsername: createdUser.slackUsername,
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
  let webhookReason = req.body.issue_event_type_name,
      webhookData = req.body,
      commentBody = req.body.comment.body;

  // continue if the webhook was sent to us because an issue was commented on
  if (webhookReason === "issue_commented") {
    // look for a user mention in the comment
    utils.getUserMentionFromComment(commentBody).then(userMentions => {
      // for each mentioned user thats signed up for this app, send slack msg
      userMentions.forEach(userMention => {
        // find if there is a user with that jira username in this app's DB
        user.getByJiraUsername(userMention).then(thisUser => {
          // send a slack message to the user
          slack.sendCommentToUser(thisUser.slackUsername, webhookData).then(result => {
            return res.sendStatus(200)
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
