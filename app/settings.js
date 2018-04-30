const APP_URL = process.env.APP_URL || `http://localhost:5000/`;
const JIRA_URL = process.env.JIRA_URL;
const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/mongo_test";
const PORT = process.env.PORT || 5000;
const slackOauthToken = process.env.SLACK_OAUTH_TOKEN;
const slackBotToken = APP_URL == 'http://localhost:5000/' ? process.env.SLACKBOT_TOKEN_DEV : process.env.SLACKBOT_TOKEN;

module.exports = {
	APP_URL,
	JIRA_URL,
	MONGO_URI,
	PORT,
	slackOauthToken,
	slackBotToken
}
