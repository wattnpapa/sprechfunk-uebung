import jQuery from "jquery";
import "select2/dist/css/select2.min.css";
import "select2-bootstrap-5-theme/dist/select2-bootstrap-5-theme.min.css";

// jQuery global machen
(window as any).$ = jQuery;
(window as any).jQuery = jQuery;

// 🔥 Select2 manuell an jQuery anhängen
import select2Factory from "select2/dist/js/select2.full.min.js";

// Falls Select2 als Funktion exportiert wird, initialisiere es manuell
if (typeof select2Factory === "function") {
  select2Factory(jQuery);
} else {
  // Falls Rollup es als Objekt liefert, einfach ausführen
  (select2Factory as any);
}

console.log("✅ Select2 setup geladen");

// jQuery exportieren
export default jQuery;