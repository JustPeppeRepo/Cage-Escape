"use client";

import Script from "next/script";

type IubendaProps = {
  siteId: string;
  cookiePolicyId: string;
};

/**
 * Carica cookie banner + loader embed iubenda.
 * Montare dal root layout solo quando gli ID pubblici sono configurati.
 */
export function Iubenda({ siteId, cookiePolicyId }: IubendaProps) {
  const csConfiguration = JSON.stringify({
    siteId: Number(siteId) || siteId,
    cookiePolicyId: Number(cookiePolicyId) || cookiePolicyId,
    lang: "it",
  });

  return (
    <>
      <Script id="iubenda-cs-configuration" strategy="beforeInteractive">
        {`var _iub = _iub || []; _iub.csConfiguration = ${csConfiguration};`}
      </Script>
      <Script
        id="iubenda-autoblocking"
        src={`https://cs.iubenda.com/autoblocking/${siteId}.js`}
        strategy="afterInteractive"
      />
      <Script
        id="iubenda-cs"
        src="https://cdn.iubenda.com/cs/iubenda_cs.js"
        strategy="afterInteractive"
      />
      <Script id="iubenda-embed-loader" strategy="lazyOnload">
        {`(function (w,d) {
  var loader = function () {
    var s = d.createElement("script"),
      tag = d.getElementsByTagName("script")[0];
    s.src = "https://cdn.iubenda.com/iubenda.js";
    tag.parentNode.insertBefore(s, tag);
  };
  if (w.addEventListener) {
    w.addEventListener("load", loader, false);
  } else if (w.attachEvent) {
    w.attachEvent("onload", loader);
  } else {
    w.onload = loader;
  }
})(window, document);`}
      </Script>
    </>
  );
}
