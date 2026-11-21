# Generates v12/index.html from the live index.html: same content, restyled by /v12/v12.css.
import re, sys, os
x = open('index.html').read()
def rep(a, b, n=1):
    global x
    c = x.count(a)
    assert c == n, (a, c)
    x = x.replace(a, b)
def sub(p, r, n):
    global x
    x, c = re.subn(p, r, x)
    assert c == n, (p, c)
V = sys.argv[1] if len(sys.argv) > 1 else '1'
rep('<meta name="theme-color" content="#FFFFFF">', '<meta name="theme-color" content="#0B0B0B">\n<meta name="robots" content="noindex, nofollow">')
rep('<link rel="canonical" href="https://getlarkin.com/">', '<link rel="canonical" href="https://getlarkin.com/v12/">')
rep('<meta property="og:url" content="https://getlarkin.com/">', '<meta property="og:url" content="https://getlarkin.com/v12/">')
sub(r'<link rel="stylesheet" href="v7\.css\?v=([0-9a-z]+)">', r'<link rel="stylesheet" href="/v7.css?v=\1">\n<link rel="stylesheet" href="/v12/v12.css?v=%s">' % V, 1)
sub(r'<script src="v7\.js\?v=', '<script src="/v7.js?v=', 1)
rep('data-theme="general" data-segment="general"', 'data-theme="general" data-segment="v12" class="v12"')
x = x.replace('client_reference_id=general', 'client_reference_id=v12')
# section themes and sheets
for a, b in [('class="section listen"', 'class="section listen sheet t-light"'),
             ('class="section ag"', 'class="section ag sheet t-dark grain"'),
             ('class="section vs"', 'class="section vs sheet t-light"'),
             ('class="section privacy"', 'class="section privacy sheet t-dark grain"'),
             ('class="section reserve"', 'class="section reserve sheet t-light"'),
             ('class="section beta"', 'class="section beta t-light"'),
             ('class="section specs-sec"', 'class="section specs-sec sheet t-dark grain"'),
             ('class="section faq-sec"', 'class="section faq-sec sheet t-light"'),
             ('class="section closing grain"', 'class="section closing grain sheet"'),
             ('class="rs__card rv"', 'class="rs__card t-dark rv"')]:
    rep(a, b)
# the lime full stop, on dark headlines only
STOP = '<span class="stop">.</span>'
for a in ['in one place.</h2>', 'by design.</h2>', 'screen-free.</h2>', 'Think more.</h2>', 'ChatGPT and Claude.</h3>']:
    rep(a, a.replace('.<', STOP + '<'))
rep('Larkin keeps you in the moment.</p>', 'Larkin keeps you in the moment' + STOP + '</p>')
sub(r'(<p class="moment__line">[^<]*)\.</p>', r'\1' + STOP + '</p>', 5)
# one head pattern: a small label over every section headline
rep('<h2 class="h2" id="vs-title">', '<p class="eyebrow">Compare</p>\n        <h2 class="h2" id="vs-title">')
sub(r'(<div class="sec-rule" aria-hidden="true"></div>\s*)(<h2 class="h2">Private and secure)', r'\1<p class="eyebrow">Privacy</p>\n        \2', 1)
sub(r'(<div class="sec-rule" aria-hidden="true"></div>\s*)(<h2 class="h2">Simple, screen-free)', r'\1<p class="eyebrow">Specs</p>\n        \2', 1)
sub(r'(<div class="sec-rule" aria-hidden="true"></div>\s*)(<h2 class="h2">Good to know)', r'\1<p class="eyebrow">FAQ</p>\n        \2', 1)
os.makedirs('v12', exist_ok=True)
open('v12/index.html', 'w').write(x)
print('ok', len(x))
