const DEFAULT_PAGE_SIZE = 500;

function withTimeout(promise, ms, label, abortController) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      abortController?.abort();
      reject(new Error(`timeout:${label}`));
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Load a Supabase table safely, paging beyond PostgREST's default row cap. */
export async function loadTableRows(client, table, columns, orderColumn, timeoutMs = 8000, retries = 1, paginate = true, pageSize = DEFAULT_PAGE_SIZE) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    let page = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      try {
        let q = client.from(table).select(columns);
        if (orderColumn) q = q.order(orderColumn, { ascending: false });
        if (paginate && typeof q.range === "function") q = q.range(from, from + pageSize - 1);
        if (controller && typeof q.abortSignal === "function") q = q.abortSignal(controller.signal);
        const { data, error } = await withTimeout(q, timeoutMs, `${table}:${from}`, controller);
        if (!error) { page = data || []; break; }
        if (attempt === retries) console.warn(`[ALLBEE] table "${table}" page ${from} unavailable: ${error.message}`);
      } catch (e) {
        if (attempt === retries) console.warn(`[ALLBEE] table "${table}" page ${from} failed: ${e.message}`);
      }
    }
    if (page === null) break;
    rows.push(...page);
    if (!paginate || page.length < pageSize) break;
  }
  return rows;
}
