var functions = {
  getUserMentionsFromComment: function(commentBody) {
    return new Promise(function(resolve, reject) {
      let userMentions = commentBody.match(/(\[~[a-zA-Z]+\])/g)
      if (userMentions.length > 0) {
        return resolve(userMentions)
      } else {
        return reject(false)
      }
    });
  },
  addJiraMarkupToUsername: function(username) {
    return `[~${username}]`
  },
  stripJiraMarkupFromUsername: function(username) {
    return username.split('[~')[1].split(']')[0]
  }
}

module.exports = functions;
