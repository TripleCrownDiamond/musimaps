import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const mobile = read('apps/mobile/src/screens/NotificationsScreen.tsx');
const appBar = read('apps/mobile/src/components/AppBar.tsx');
const web = read('apps/web/src/pages/Notifications.tsx');
const webHeader = read('apps/web/src/components/SecondaryPageHeader.tsx');

test('les notifications natives utilisent la barre commune sous la zone système', () => {
  assert.match(mobile, /useSafeAreaInsets\(\)/);
  assert.match(mobile, /paddingTop: insets\.top \+ APP_BAR_TOP_GAP/);
  assert.match(mobile, /<AppBar[\s\S]*?backOverride[\s\S]*?navigation\.canGoBack\(\)/);
  assert.doesNotMatch(mobile, /headerRow:|headerActions:/);
});

test('la lecture globale précède la cloche sur les deux surfaces', () => {
  for (const screen of [mobile, web]) assert.match(screen, /beforeNotification=\{/);
  assert.ok(appBar.indexOf('{beforeNotification}') < appBar.indexOf('accessibilityLabel={t(\'notif.title\')}'));
  assert.ok(webHeader.indexOf('{beforeNotification}') < webHeader.indexOf('<NotificationBell'));
});

test('la lecture globale est désactivée sans non-lus et met à jour le compteur', () => {
  for (const screen of [mobile, web]) {
    assert.match(screen, /disabled=\{unread === 0 \|\| markingAll\}/);
    assert.match(screen, /unreadCount=\{unread\}/);
  }
});
