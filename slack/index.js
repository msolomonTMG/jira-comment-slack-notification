const
  request = require('request'),
  SlackBot = require('slackbots'),
  user = require('../user'),
  slackOauthToken = process.env.SLACK_OAUTH_TOKEN,
  APP_URL = process.env.APP_URL || `http://localhost:5000/`;

let slackBotToken;

if (APP_URL == 'http://localhost:5000/') {
  slackBotToken = process.env.SLACKBOT_TOKEN_DEV
} else {
  slackBotToken = process.env.SLACKBOT_TOKEN
}

var bot = new SlackBot({
  token: slackBotToken,
  name: 'Jira Comment Bot'
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
              bot.postMessageToUser(username, `:chipmunk: Slow down, Eager McBeaver! You need to signup first. Signup by <${APP_URL}user/create?slackUsername=${username}|clicking here>`)
            } else if (!thisUser.jiraToken || !thisUser.jiraTokenSecret) {
              let params = {}

              let attachments = [{
                text: `To respond within Slack, you must first Auth with Jira`,
                fallback: "Auth with Jira",
                callback_id: "auth_with_jira",
                attachment_type: "default",
                actions: [{
                  text: "Auth with Jira",
                  type: "button",
                  url: `${APP_URL}auth?slackUsername=${username}&slackUserId=${message.user}`
                }]
              }]

              params.attachments = JSON.stringify(attachments)

              bot.postMessageToUser(username, 'youre one signed up bro', params, function(data) {
                return resolve(data)
              })
            } else {
              let params = {}

              let text = `:speech_balloon: mentioned you in a JIRA comment.`

              let attachments = [{
                fallback: "Respond without leaving Slack",
                callback_id: "pop_comment_dialog",
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
              bot.postMessageToUser(username, `:chipmunk: Slow down, Eager McBeaver! You need to signup first. Signup by <${APP_URL}user/create?slackUsername=${username}|clicking here>`)
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
              bot.postMessageToUser(username, `Signup by <${APP_URL}user/create?slackUsername=${username}|clicking here>`)
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
  openCommentDialog: function(payload) {
    return new Promise(function(resolve, reject) {
      let issueKey = payload.actions[0].value.split('|')[0]
      let commentCreator = payload.actions[0].value.split('|')[1]
      
      let dialog = {
        callback_id: `create_comment|${issueKey}`,
        title: "Respond to Comment",
        submit_label: "Comment",
        elements: [
          {
            label: "Comment",
            name: "comment",
            type: "textarea",
            value: `[~${commentCreator}] `,
            optional: false
          }
        ]
      }

      let urlEncodedDialog = encodeURIComponent(JSON.stringify(dialog))
      console.log(payload)
      let options = {
        method: 'post',
        json: true,
        url: `https://slack.com/api/dialog.open?token=${slackBotToken}&trigger_id=${payload.trigger_id}&dialog=${urlEncodedDialog}`
      }
      
      request(options, function(err, res, body) {
        if (err) {
          console.error('error posting json: ', err)
          return reject(err)
        } else {
          console.log('popped create ticket dialog')
          console.log(body)
          return resolve(true)
        }
      })
    });
  },
  sendSettingsToUser: function(user) {
    return new Promise(function(resolve, reject) {
      bot.postMessageToUser(user.slackUsername, `:hammer_and_wrench: <${APP_URL}settings?slackUsername=${user.slackUsername}| Click here> to adjust your settings`, function(data) {
        return resolve(data)
      })
    })
  },
  sendMessageToUser: function(slackUsername, message) {
    return new Promise(function(resolve, reject) {
      
      bot.postMessageToUser(slackUsername, message, function(data) {
        return resolve(data)
      })
      
    });
  },
  sendCommentToUser: function(thisUser, jiraData) {
    console.log(jiraData)
    console.log(thisUser)
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
      
      // send the user an Auth with Jira button if they did not do so already
      if (!thisUser.jiraToken || !thisUser.jiraTokenSecret) {
        attachments.push({
          text: `:wave: Great news! You can now respond to Jira comments within Slack! To do so, you must first Auth with Jira`,
          fallback: "Auth with Jira",
          callback_id: "auth_with_jira",
          attachment_type: "default",
          actions: [{
            text: ":lock: Auth with Jira",
            type: "button",
            url: `${APP_URL}auth?slackUsername=${thisUser.slackUsername}`
          }]
        })
      } else {
        attachments.push({
          fallback: "Respond without leaving Slack",
          callback_id: "pop_comment_dialog",
          attachment_type: "default",
          actions: [{
            name: "respond",
            style: "primary",
            text: "Respond from Slack",
            type: "button",
            value: `${issue.key}|${comment.author.key}`
          }]
        })
      }
      params.attachments = JSON.stringify(attachments)

      bot.postMessageToUser(thisUser.slackUsername, text, params, function(data) {
        return resolve(data)
      })
    });
  }
}

module.exports = functions;
