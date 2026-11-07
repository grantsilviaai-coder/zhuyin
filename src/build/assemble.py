import sys
url = sys.argv[1] if len(sys.argv)>1 else ''
old=open('zhuyin.html',encoding='utf-8').read()
head=old[:old.index('</style>')]
extra=open('build/extra.css',encoding='utf-8').read()
body=open('build/body.html',encoding='utf-8').read()
raw=open('build/raw.txt',encoding='utf-8').read()
app=open('build/qrlib.js',encoding='utf-8').read()+'\n'+(open('build/app.js',encoding='utf-8').read()+'\n'+open('build/test.js',encoding='utf-8').read()).replace('__SCRIPT_URL__',url)
out=head+extra+'</style>\n</head>\n'+body+'\n<script>\n'+raw+'\n\n'+app+'</script>\n</body>\n</html>\n'
open(sys.argv[2] if len(sys.argv)>2 else 'site/index.html','w',encoding='utf-8').write(out)
