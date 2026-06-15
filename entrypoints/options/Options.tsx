import { useState, useEffect } from 'preact/hooks';

const DEFAULT_SETTINGS = {
  apiUrl: '',
  email: '',
  slackWebhook: '',
  telegramToken: '',
  telegramChatId: '',
};

type Settings = typeof DEFAULT_SETTINGS;

export function Options() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
      setSettings(items as Settings);
    });
  }, []);

  const update = (key: keyof Settings, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const save = () => {
    chrome.storage.sync.set(settings, () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  };

  return (
    <div class="options">
      <h1>PriceSentinel Settings</h1>

      <section>
        <h2>Backend</h2>
        <label>
          API URL
          <input
            type="url"
            placeholder="https://api.pricesentinel.dev"
            value={settings.apiUrl}
            onInput={(e) => update('apiUrl', (e.target as HTMLInputElement).value)}
          />
        </label>
      </section>

      <section>
        <h2>Notifications</h2>
        <label>
          Email (via SMTP)
          <input
            type="email"
            placeholder="you@example.com"
            value={settings.email}
            onInput={(e) => update('email', (e.target as HTMLInputElement).value)}
          />
        </label>
        <label>
          Slack Webhook URL
          <input
            type="url"
            placeholder="https://hooks.slack.com/..."
            value={settings.slackWebhook}
            onInput={(e) => update('slackWebhook', (e.target as HTMLInputElement).value)}
          />
        </label>
        <label>
          Telegram Bot Token
          <input
            type="text"
            placeholder="123456:ABC-DEF..."
            value={settings.telegramToken}
            onInput={(e) => update('telegramToken', (e.target as HTMLInputElement).value)}
          />
        </label>
        <label>
          Telegram Chat ID
          <input
            type="text"
            placeholder="-1001234567890"
            value={settings.telegramChatId}
            onInput={(e) => update('telegramChatId', (e.target as HTMLInputElement).value)}
          />
        </label>
      </section>

      <button onClick={save}>{saved ? '✓ Saved!' : 'Save'}</button>
    </div>
  );
}
