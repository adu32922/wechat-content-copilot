import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  rootDir: path.resolve(here, '..'),
  outputDir: path.resolve(here, '..', 'outputs'),
  topicsFile: path.resolve(here, '..', 'data', 'topics.json'),
  port: Number(process.env.PORT || 3210),
  demoMode: String(process.env.DEMO_MODE ?? 'true').toLowerCase() === 'true',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  textModel: process.env.OPENAI_TEXT_MODEL || 'gpt-6-astra',
  imageModel: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2.5-flare',
  wechatAppId: process.env.WECHAT_APP_ID || '',
  wechatAppSecret: process.env.WECHAT_APP_SECRET || '',
  scheduleCron: process.env.SCHEDULE_CRON || '*/10 * * * *',
};

export function getReadiness() {
  return {
    demoMode: config.demoMode,
    openaiReady: Boolean(config.openaiApiKey),
    wechatReady: Boolean(config.wechatAppId && config.wechatAppSecret),
  };
}
