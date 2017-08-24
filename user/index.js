var
  mongoose = require('mongoose'),
  utils = require('../utils');

var userSchema = new mongoose.Schema({
  jiraUsername: String,
  slackUsername: String
});

var User = mongoose.model('Users', userSchema);

var functions = {
  create: function(userObj) {
    return new Promise(function (resolve, reject) {

      if (!userObj.jiraUsername || !userObj.slackUsername) {
        return reject({
          error: {
            msg: 'User must have jira username, slack username set'
          }
        })
      } else {
        newUser = new User ({
          jiraUsername: utils.addJiraMarkupToUsername(userObj.jiraUsername),
          slackUsername: userObj.slackUsername
        });
        newUser.save(function (err, user) {
          if (err) {
            return reject(err)
          } else {
            return resolve(user)
          }
        });
      }

    })
  },
  getByJiraUsername: function(jiraUsername) {
    return new Promise(function(resolve, reject) {

      User.findOne({
        jiraUsername: jiraUsername
      }, function(err, user) {
        if(!err) {
          return resolve(user)
        } else {
          return reject(err)
        }
      })

    });
  },
  getBySlackUsername: function(slackUsername) {
    return new Promise(function(resolve, reject) {

      User.findOne({
        slackUsername: slackUsername
      }, function(err, user) {
        if(!err) {
          return resolve(user)
        } else {
          return reject(err)
        }
      })

    });
  }
}

module.exports = functions;
