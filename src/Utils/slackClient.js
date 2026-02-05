import { WebClient } from '@slack/web-api';
import dotenv from 'dotenv';

dotenv.config();

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

export async function sendSlackMessage(channel, message, blocks = null) {
  try {
    const result = await slack.chat.postMessage({
      channel,
      text: message,
      ...(blocks && { blocks }),
    });
    console.log('✅ Slack message sent:', result.ts);
  } catch (error) {
    console.error('❌ Slack error:', error);
  }
}
