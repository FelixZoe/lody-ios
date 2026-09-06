"""Run with a prepared draft in a disposable live session. This sends a real turn."""
import argparse
import json
import pathlib
import subprocess
import time

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('udid')
parser.add_argument('--expect', choices=['success', 'failure'], required=True)
parser.add_argument('--output', required=True)
args = parser.parse_args()
out = pathlib.Path(args.output)
out.mkdir(parents=True, exist_ok=True)

def axe(*command):
    return subprocess.check_output(['axe', *command, '--udid', args.udid], text=True)

def elements(tree):
    for item in tree:
        yield item
        yield from elements(item.get('children', []))

def state():
    return list(elements(json.loads(axe('describe-ui'))))

def input_text(items):
    return next(item for item in items if item.get('AXUniqueId') == 'session-input').get('AXValue') or ''

def attachments(items):
    return [item['AXLabel'] for item in items if (item.get('AXLabel') or '').startswith('预览附件 ')]

def shot(name):
    subprocess.run(['xcrun', 'simctl', 'io', args.udid, 'screenshot', str(out / name)], check=True, capture_output=True)

before = state()
draft, picked = input_text(before), attachments(before)
assert draft or picked, 'Prepare a draft before running this check'
button = next(item for item in before if item.get('AXUniqueId') == 'session-send')
assert button['enabled'], 'The session must be ready'
shot('before.png')
started = time.monotonic()
axe('tap', '--id', 'session-send')
loading = state()
(out / 'loading-ui.json').write_text(json.dumps(loading, ensure_ascii=False, indent=2))
if args.expect == 'success':
    assert input_text(loading) == '' and not attachments(loading), 'Draft must clear immediately'
    send = next(item for item in loading if item.get('AXUniqueId') == 'session-send')
    assert send['AXLabel'] == '正在发送' and not send['enabled'], 'Send must be busy and disabled'
    assert not any(item.get('type') == 'StaticText' and item.get('AXLabel') in ['正在发送…', '正在发送消息'] for item in loading)
    shot('loading.png')
    # A second physical tap must not dispatch another turn.
    frame = send['frame']
    axe('tap', '-x', str(frame['x'] + frame['width'] / 2), '-y', str(frame['y'] + frame['height'] / 2))

while time.monotonic() - started < 90:
    current = state()
    if any(item.get('AXLabel') == '消息尚未发送' for item in current):
        assert args.expect == 'failure', 'The live send failed'
        shot('failure.png')
        axe('tap', '--label', 'OK', '--element-type', 'Button')
        current = state()
        assert input_text(current) == draft and attachments(current) == picked, 'Failure must restore exact text and attachments'
        send = next(item for item in current if item.get('AXUniqueId') == 'session-send')
        assert send['enabled'] and send['AXLabel'] == '发送', 'Retry must be enabled'
        break
    send = next((item for item in current if item.get('AXUniqueId') == 'session-send'), {})
    if args.expect == 'success' and send.get('AXLabel') == '发送' and not input_text(current):
        messages = [item for item in current if item.get('type') == 'StaticText' and item.get('AXLabel') == draft]
        assert len(messages) == 1, 'Double tap must produce exactly one user message'
        assert not attachments(current)
        break
    time.sleep(0.3)
else:
    raise AssertionError('Send did not settle within 90 seconds')
shot('after.png')
(out / 'after-ui.json').write_text(json.dumps(current, ensure_ascii=False, indent=2))
print(f'PASS: composer {args.expect}; elapsed={time.monotonic() - started:.2f}s')
