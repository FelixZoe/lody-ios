"""Verify menus and the real pasteboard in the local Debug chat preview only."""
import argparse, json, pathlib, signal, subprocess, time
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('udid')
p.add_argument('--output', required=True)
a = p.parse_args()
out = pathlib.Path(a.output); out.mkdir(parents=True, exist_ok=True)
def run(*args): return subprocess.check_output(args, text=True)
def axe(*args): return run('axe', *args, '--udid', a.udid)
def nodes(items):
 for item in items:
  yield item
  yield from nodes(item.get('children', []))
def state(): return list(nodes(json.loads(axe('describe-ui'))))
def shot(name): run('xcrun', 'simctl', 'io', a.udid, 'screenshot', str(out / (name + '.png')))
def hold(x,y):
 axe('touch', '-x', str(x), '-y', str(y), '--down', '--up', '--delay', '.8'); time.sleep(1.5)
def tap(label): axe('tap', '--label', label)
def clipboard(): return run('xcrun', 'simctl', 'pbpaste', a.udid)
code = 'let layout = UICollectionViewFlowLayout()\nlet list = UICollectionView(\n  frame: .zero,\n  collectionViewLayout: layout\n)'
run('xcrun','simctl','openurl',a.udid,'lody-ios:///debug'); time.sleep(1)
axe('tap', '--id', 'chat-preview'); time.sleep(2)
assert any(n.get('AXLabel') == 'Retry' for n in state()), 'Only run against Debug preview'
(out / 'selection.mp4').unlink(missing_ok=True)
video = subprocess.Popen(['xcrun','simctl','io',a.udid,'recordVideo',str(out / 'selection.mp4')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
records = {}
try:
 hold(160,607); shot('ai-menu'); tap('复制此块'); time.sleep(1)
 records['code'] = clipboard(); assert records['code'] == code
 hold(160,607); tap('选择此块'); time.sleep(2); shot('whole-selection')
 assert any(n.get('AXLabel') == 'Copy' for n in state()), 'Native selection menu must be available'
 axe('swipe','--start-x','40','--start-y','676','--end-x','294','--end-y','601','--duration','1','--delta','2'); time.sleep(1)
 shot('partial-selection')
 axe('tap','--label','Copy','--element-type','GenericElement'); time.sleep(.5)
 records['partial'] = clipboard(); assert records['partial'] and records['partial'] != code and records['partial'] in code
 axe('tap','-x','360','-y','700')
 axe('swipe','--start-x','200','--start-y','280','--end-x','200','--end-y','750','--duration','.6'); time.sleep(2)
 user = next(n for n in state() if (n.get('AXUniqueId') or '').endswith(':user') and 140 < n['frame']['y'] < 680)
 hold(280,user['frame']['y'] + 30); shot('user-menu'); tap('复制'); time.sleep(1)
 records['user'] = clipboard(); assert records['user'] == '请继续检查聊天页面的原生布局。'
 shot('user-copied')
 print(json.dumps(records, ensure_ascii=False, indent=2))
 (out / 'clipboard.json').write_text(json.dumps(records,ensure_ascii=False,indent=2))
finally:
 video.send_signal(signal.SIGINT); video.wait(timeout=15)
