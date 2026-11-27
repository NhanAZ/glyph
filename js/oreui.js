import "https://cdn.jsdelivr.net/npm/oreui-web@0.0.1/button/+esm";
import "https://cdn.jsdelivr.net/npm/oreui-web@0.0.1/container/+esm";
import "https://cdn.jsdelivr.net/npm/oreui-web@0.0.1/divider/+esm";
import "https://cdn.jsdelivr.net/npm/oreui-web@0.0.1/dropdown/+esm";
import "https://cdn.jsdelivr.net/npm/oreui-web@0.0.1/icon-button/+esm";
import "https://cdn.jsdelivr.net/npm/oreui-web@0.0.1/modal/+esm";
import "https://cdn.jsdelivr.net/npm/oreui-web@0.0.1/scrollbar/+esm";
import "https://cdn.jsdelivr.net/npm/oreui-web@0.0.1/spinner/+esm";
import "https://cdn.jsdelivr.net/npm/oreui-web@0.0.1/textfield/+esm";
import "https://cdn.jsdelivr.net/npm/oreui-web@0.0.1/toast/+esm";

const appScripts = ["state.js", "defaults.js", "utils.js", "converter.js?v=20261127-copy-feedback", "glyph.js", "main.js?v=20261127-oreui-validation"];

for (const source of appScripts) {
	await new Promise((resolve, reject) => {
		const script = document.createElement("script");
		script.src = new URL(source, import.meta.url).href;
		script.onload = resolve;
		script.onerror = () => reject(new Error(`Unable to load ${source}.`));
		document.body.appendChild(script);
	});
}
