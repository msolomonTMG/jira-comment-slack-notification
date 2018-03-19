const
  request = require('request'),
  APP_URL = process.env.APP_URL || 'http://localhost:5000/',
  JIRA_URL = process.env.JIRA_URL || 'https://nowthis.atlassian.net',
  OAuth = require('oauth').OAuth;

let privateKey = Buffer.from(process.env.RSA_PRIVATE_KEY, 'base64').toString();
// if (APP_URL == 'http://localhost:5000/') {
//   let fs = require('fs')
//   privateKey = fs.readFileSync('./rsa-key.pem', 'utf8')
//   privateKey = privateKey.toString()
// } else {
//   privateKey = process.env.RSA_PRIVATE_KEY
// }

//TODO: use jira_url here
var consumer =
  new OAuth(`${JIRA_URL}/plugins/servlet/oauth/request-token`,
                  `${JIRA_URL}/plugins/servlet/oauth/access-token`,
                  'neptune-the-dodle',
                  privateKey,
                  "1.0",
                  `${APP_URL}auth/atlassian-oauth/callback`,
                  "RSA-SHA1",
				          null);

var helpers = {

  makeJiraRequest: function(user, url, method, payload) {
    return new Promise(function(resolve, reject) {
      console.log('user creds')
      console.log(user)
      consumer._performSecureRequest(user.jiraToken,
        user.jiraTokenSecret,
        method.toUpperCase(),
        url,
        null,
        payload,
        'application/json',
        function(error, data, resp) {
          console.log("---------ERROR---------")
          console.log(error)
          // console.log("---------DATA---------")
          // console.log(data)
          // console.log("---------RESP---------")
          // console.log(resp)
          return resolve(data)
        })
    });
  }

}

var functions = {
  createComment: function(user, issueKey, comment) {
    return new Promise(function(resolve, reject) {
      console.log(`Issue key is: ${issueKey}`)
      let url = `${JIRA_URL}/rest/api/2/issue/${issueKey}/comment`
      let data = JSON.stringify({
        body: comment
      })
      
      helpers.makeJiraRequest(user, url, 'post', data).then(success => {
        return resolve(success)
      })
      
    });
  },
  getTicketInfo: function(user, url) {
    return new Promise(function(resolve, reject) {

      helpers.makeJiraRequest(user, url, 'get')
        .then(ticket => {
          console.log('TICKET')
          console.log(ticket)
          return resolve(JSON.parse(ticket))
        })
        .catch(err => {
          return reject(err)
        })

    });
  },
  labelIssue: function(user, issue, label) {
    return new Promise(function(resolve, reject) {
      let url = `${JIRA_URL}/rest/api/2/issue/${issue.key}`
      let data = JSON.stringify({
        update: {
          labels: [{
            add: `${label}`
          }]
        }
      })

      helpers.makeJiraRequest(user, url, 'put', data)
        .then(result => {
          return resolve(JSON.parse(result))
        })
        .catch(err => {
          console.log('error adding label to jira issue')
          return reject(err)
        })

    });
  },
  assignIssue: function(user, issue, assignee) {
    return new Promise(function(resolve, reject) {
      let url = `${JIRA_URL}/rest/api/2/issue/${issue.key}/assignee`
      let data = JSON.stringify({
        name: assignee
      })

      helpers.makeJiraRequest(user, url, 'put', data)
        .then(result => {
          return resolve(result)
        })
        .catch(err => {
          console.log('error assigning issue')
          return reject(err)
        })
    });
  },
  getActiveSprint: function(user, boardId) {
    return new Promise(function(resolve, reject) {
      console.log('getting active sprint')
      let url = `${JIRA_URL}/rest/agile/1.0/board/${boardId}/sprint`

      helpers.makeJiraRequest(user, url, 'get')
        .then(result => {
          result = JSON.parse(result)
          let sprints = result.values
          sprints.forEach((sprint, index) => {
            if (sprint.state == "active") {
              return resolve(sprint)
            } else if (sprint.length == index + 1) {
              return reject({ error: "no active sprints" })
            }
          })
        })
        .catch(err => {
          console.log('error getting active sprint')
          console.log(err)
          return reject(err)
        })
      });
  },
  addIssueToActiveSprint: function(user, issue, activeSprint) {
    return new Promise(function(resolve, reject) {
      console.log('adding to active sprint...')
      let url = `${JIRA_URL}/rest/agile/1.0/sprint/${activeSprint.id}/issue`
      let data = JSON.stringify({ "issues": [ issue.key ] })

      helpers.makeJiraRequest(user, url, 'post', data)
        .then(success => {
          console.log('success')
          return resolve(success)
        })
        .catch(err => {
          console.log('error adding to active sprint')
          console.log(err)
          return reject(err)
        })
      });
  },
  createTicket: function(user, payload) {
    return new Promise(function(resolve, reject) {
      console.log('creating ticket')
      //TODO: understand the slack payload
      let ticketData = JSON.stringify({
        fields: {
          project: {
            key: payload.project
          },
          summary: payload.summary,
          description: payload.description,
          issuetype: {
            name: "Task"
          }
        }
      })

      helpers.makeJiraRequest(user, `${JIRA_URL}/rest/api/2/issue/`, 'post', ticketData)
        .then(ticket => {
          console.log(JSON.parse(ticket))
          return resolve(JSON.parse(ticket))
        })
        .catch(err => {
          return reject(err)
        })

    })
  }
}

module.exports = functions;
