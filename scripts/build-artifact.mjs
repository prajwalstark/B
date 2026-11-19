// Builds a single self-contained pitwall.html (React from cdnjs, everything else inline).
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

execSync('npx vite build --config vite.artifact.config.ts', { stdio: 'inherit' });
const dir = 'dist-artifact';
const js = readFileSync(`${dir}/app.js`, 'utf8');
const cssFile = readdirSync(dir).find((f) => f.endsWith('.css'));
const css = cssFile ? readFileSync(`${dir}/${cssFile}`, 'utf8') : '';

const html = `<title>Pitwall Race Tracker</title>
<meta name="theme-color" content="#16181c">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@300;400;500;600;700&display=swap">
<style>:root{color-scheme:dark}html,body{background:#151618}
${css}</style>
<div id="root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>
window.ReactJSXRuntime = (function (R) {
  function jsx(type, props, key) { return R.createElement(type, key === undefined ? props : Object.assign({}, props, { key: key })); }
  return { jsx: jsx, jsxs: jsx, Fragment: R.Fragment };
})(window.React);
</script>
<script>
${js.replace(/<\/script/gi, '<\\/script')}
</script>
`;
writeFileSync(`${dir}/pitwall.html`, html);
console.log('wrote', `${dir}/pitwall.html`, (html.length / 1024).toFixed(1) + ' KB');
