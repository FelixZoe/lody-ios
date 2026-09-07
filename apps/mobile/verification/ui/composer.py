"""Real sheet keyboard, duplicate-send suppression and exact rejected-draft restore."""
import sys
from driver import UI

ui = UI(*sys.argv[1:])
ui.axe('tap', '--id', 'create-session-input')
ui.axe('type', 'Offline draft\nSecond line')
screen_height = ui.state()[0]['frame']['height']
keyboard = ui.wait(lambda items: next((i['frame'] for i in items if (i.get('AXUniqueId') or '').startswith('UIKeyboardLayoutStar') and i['frame']['y'] < screen_height - 150), None), 'Software keyboard did not appear')
keyboard_top = min([keyboard['y']] + [i['frame']['y'] for i in ui.state() if i.get('AXLabel') == 'Typing Predictions'])
send = ui.element('session-send')
assert send['frame']['y'] + send['frame']['height'] <= keyboard_top + 1, 'Keyboard covers the send control'
draft = ui.element('create-session-input')['AXValue']
ui.capture('keyboard')
ui.axe('tap', '--id', 'session-send')
assert not ui.element('session-send')['enabled'], 'Pending send must be disabled'
assert not ui.element('create-session-input').get('AXValue'), 'Pending draft must clear'
frame = send['frame']
ui.axe('tap', '-x', str(frame['x'] + frame['width']/2), '-y', str(frame['y'] + frame['height']/2))
ui.axe('tap', '--label', 'Complete Request')
ui.wait(lambda items: any(i.get('AXUniqueId') == 'create-session-input' and i.get('AXValue') == draft for i in items), 'Rejected draft was not restored')
assert ui.element('session-send')['enabled']
assert ui.element('composer-result')['AXLabel'] == 'Requests: 1', 'Duplicate tap dispatched twice'
ui.capture('restored')
print('PASS: sheet keyboard clearance, exact draft restore and duplicate suppression')
