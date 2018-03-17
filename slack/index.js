const
  SlackBot = require('slackbots'),
  user = require('../user'),
  APP_URL = process.env.APP_URL || `http://localhost:5000/`;

let slackBotToken;

if (APP_URL == 'http://localhost:5000/') {
  slackBotToken = process.env.SLACKBOT_TOKEN_DEV
} else {
  slackBotToken = process.env.SLACKBOT_TOKEN
}

var bot = new SlackBot({
  token: slackBotToken,
  name: 'JIRA'
});

bot.on('message', function(message) {
  // all ingoing events https://api.slack.com/rtm
  if (message.type == 'message' && message.user != null) {
    console.log('got a message', message)
    switch(message.text) {
      case 'test':
        helpers.getUsernameFromId(message.user).then(username => {
          user.getBySlackUsername(username).then(thisUser => {
            if(!thisUser) {
              bot.postMessageToUser(username, 'you gotta sign up first!')
            } else {
              let params = {}

              let text = `:speech_balloon: mentioned you in a JIRA comment.`

              let attachments = [{
                fallback: "Respond without leaving Slack",
                callback_id: "respond_to_comment",
                attachment_type: "default",
                actions: [{
                  name: "respond",
                  style: "primary",
                  text: "Respond from Slack",
                  type: "button",
                  value: "respond"
                }]
              }]

              params.attachments = JSON.stringify(attachments)

              bot.postMessageToUser(username, 'youre one signed up bro', params, function(data) {
                return resolve(data)
              })
            }
          })
        })
      break;
      case 'settings':
        helpers.getUsernameFromId(message.user).then(username => {
          user.getBySlackUsername(username).then(user => {
            if (!user) {
              bot.postMessageToUser(username, `:chipmunk: Slow down, Eager McBeaver! You need to signup first. Signup by <${APP_URL}signup|clicking here>`)
            } else {
              functions.sendSettingsToUser(user) //we need the user to send random string query param
            }
          })
        })
      break;
      case 'signup':
        helpers.getUsernameFromId(message.user).then(username => {
          user.getBySlackUsername(username).then(user => {

            console.log(user)
            if (user) {
              bot.postMessageToUser(username, `You're already signed up!`).then(function() {
                functions.sendSettingsToUser(user)
              })
            } else {
              console.log('no user')
              bot.postMessageToUser(username, `Signup by <${APP_URL}signup|clicking here>`)
            }

          })
        })
      break;
      default:
        console.log('default is happening')
        helpers.getUsernameFromId(message.user).then(username => {
          let response = ':wave: I can only do a few things right now. Say `settings` to adjust your settings or say `signup` to signup!. I plan on getting smarter eventually!'
          bot.postMessageToUser(username, response).fail(function(data) {
            //data = { ok: false, error: 'user_not_found' }
            console.log(data)
          })
        })
    }
  }
});

var helpers = {
  getUsernameFromId: function(id) {
    return new Promise(function(resolve, reject) {
      bot.getUsers().then(data => {
        data.members.forEach((user, index) => {
          if (user.id == id) {
            return resolve(user.name)
          }
        })
      })
    });
  }
}

var functions = {
  sendSettingsToUser: function(user) {
    return new Promise(function(resolve, reject) {
      bot.postMessageToUser(user.slackUsername, `:hammer_and_wrench: <${APP_URL}settings?slackUsername=${user.slackUsername}| Click here> to adjust your settings`, function(data) {
        return resolve(data)
      })
    })
  },
  sendCommentToUser: function(slackUsername, jiraData) {
    console.log(jiraData)
    return new Promise(function(resolve, reject) {
      let
        jiraUrl = jiraData.issue.self.split('/rest/api')[0],
        issue = jiraData.issue,
        comment = jiraData.comment,
        text = ``,
        params = {};

      text = `:speech_balloon: ${comment.author.displayName} mentioned you in a JIRA comment.`

      let attachments = [{
        fallback: text,
        title: `<${jiraUrl}/browse/${issue.key}|${issue.key}: ${issue.fields.summary}>`,
        thumb_url: `${comment.author.avatarUrls["48x48"]}`,
        fields: [
          {
            title: "Type",
            value: `${issue.fields.issuetype.name}`,
            short: true
          },
          {
            title: "Status",
            value: `${issue.fields.status.name}`,
            short: true
          },
          {
            title: "Comment",
            value: `${comment.body}`,
            short: false
          }
        ]
      }]

      params.attachments = JSON.stringify(attachments)

      bot.postMessageToUser(slackUsername, text, params, function(data) {
        return resolve(data)
      })
    });
  }
}

module.exports = functions;
