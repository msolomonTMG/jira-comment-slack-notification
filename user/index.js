var
  mongoose = require('mongoose'),
  utils = require('../utils');

var userSchema = new mongoose.Schema({
  slackUsername: String,
  jiraUsername: String,
  jiraToken: String,
  jiraTokenSecret: String
});

var User = mongoose.model('Users', userSchema);

var functions = {
  deleteMike: function() {
    return new Promise(function(resolve, reject) {
      User.remove({
        slackUsername: 'mike'
      },function(success) {
        return resolve(success)
      })
    });
  },
  deleteMikeToken: function() {
    return new Promise(function(resolve, reject) {
      console.log('trying')
      functions.getBySlackUsername('mike').then(mike => {
        console.log('mike')
        console.log(mike)
        User.update(
          { _id: mike._id },
          { $set: {jiraToken: null, jiraTokenSecret: null} },
          function(err, result) {
            if (err) {
              return reject(err);
            } else {
              User.findOne({
                _id: mike._id
              }, function(err, user) {
                if(!err) {
                  return resolve(user)
                } else {
                  return reject(err)
                }
              })
            }
          }
        );
      })
    });
  },
  update: function(mongoId, updates) {
    console.log('I AM UPDATING USER ' + mongoId)
    return new Promise(function(resolve, reject) {
      User.update(
        { _id: mongoId },
        { $set: updates },
        function(err, result) {
          if (err) {
            return reject(err);
          } else {
            User.findOne({
              _id: mongoId
            }, function(err, user) {
              if(!err) {
                return resolve(user)
              } else {
                return reject(err)
              }
            })
          }
        }
      );
    })
  },
  create: function(userObj) {
    return new Promise(function (resolve, reject) {

      newUser = new User ({
        slackUsername: userObj.slackUsername
        // jiraUsername: utils.addJiraMarkupToUsername(userObj.jiraUsername),
        // jiraToken: userObj.jiraToken,
        // jiraTokenSecret: userObj.jiraTokenSecret
      });
      newUser.save(function (err, user) {
        if (err) {
          return reject(err)
        } else {
          return resolve(user)
        }
      });

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
      console.log("GETTING USER")
      User.findOne({
        slackUsername: slackUsername
      }, function(err, user) {
        console.log("ERROR" + err)
        console.log("USER" + user)
        if(!err) {
          return resolve(user)
        } else {
          return reject(err)
        }
      })

    });
  },
  getBySlackUserId: function(slackUserId) {
    return new Promise(function(resolve, reject) {

      User.findOne({
        slackUserId: slackUserId
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
