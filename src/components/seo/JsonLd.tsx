type JsonLdProps = {
  data: Record<string, unknown> | Record<string, unknown>[];
};

/** Blocco JSON-LD sicuro (escape di `<` per evitare break-out da `</script>`). */
export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
