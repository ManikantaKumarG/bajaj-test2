const apiBaseUrlInput = document.getElementById("apiBaseUrl");
const nodeInput = document.getElementById("nodeInput");
const submitBtn = document.getElementById("submitBtn");
const statusEl = document.getElementById("status");
const summaryBox = document.getElementById("summaryBox");
const hierarchyBox = document.getElementById("hierarchyBox");
const rawJson = document.getElementById("rawJson");

apiBaseUrlInput.value = window.location.origin;
nodeInput.value = [
  "A->B",
  "A->C",
  "B->D",
  "C->E",
  "E->F",
  "X->Y",
  "Y->Z",
  "Z->X",
  "G->H",
  "G->H",
  "hello",
].join("\n");

function setStatus(message, kind = "") {
  statusEl.textContent = message;
  statusEl.className = `status ${kind}`.trim();
}

function splitEntries(value) {
  return value
    .split(/[\n,]+/g)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

function renderSummary(summary) {
  summaryBox.innerHTML = "";
  const pairs = [
    ["Total Trees", summary?.total_trees ?? "-"],
    ["Total Cycles", summary?.total_cycles ?? "-"],
    ["Largest Tree Root", summary?.largest_tree_root ?? "-"],
  ];

  for (const [label, value] of pairs) {
    const item = document.createElement("div");
    item.className = "summary-item";
    item.innerHTML = `<span class="summary-label">${label}</span><span class="summary-value">${value}</span>`;
    summaryBox.appendChild(item);
  }
}

function renderHierarchies(hierarchies = []) {
  hierarchyBox.innerHTML = "";
  if (!hierarchies.length) {
    hierarchyBox.textContent = "No hierarchies in response.";
    return;
  }

  for (const item of hierarchies) {
    const card = document.createElement("article");
    card.className = "hierarchy-card";

    const meta = item.has_cycle
      ? `Cycle detected`
      : `Depth: ${item.depth ?? "-"}`;

    card.innerHTML = `
      <strong>Root: ${item.root}</strong>
      <div>${meta}</div>
      <pre>${JSON.stringify(item.tree, null, 2)}</pre>
    `;
    hierarchyBox.appendChild(card);
  }
}

submitBtn.addEventListener("click", async () => {
  const baseUrl = apiBaseUrlInput.value.trim().replace(/\/+$/, "");
  const data = splitEntries(nodeInput.value);

  if (!baseUrl) {
    setStatus("Please enter API base URL.", "error");
    return;
  }

  setStatus("Calling API...", "");
  submitBtn.disabled = true;

  try {
    const response = await fetch(`${baseUrl}/bfhl`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });

    const responseText = await response.text();
    let payload = null;
    try {
      payload = responseText ? JSON.parse(responseText) : null;
    } catch (_err) {
      throw new Error(
        "Backend did not return valid JSON. Please use your backend base URL (not a static frontend URL)."
      );
    }

    if (!payload || typeof payload !== "object") {
      throw new Error(
        "Empty response from backend. Check your backend URL and make sure /bfhl is deployed."
      );
    }

    if (!response.ok) {
      throw new Error(payload?.message || "Request failed");
    }

    renderSummary(payload.summary);
    renderHierarchies(payload.hierarchies);
    rawJson.textContent = JSON.stringify(payload, null, 2);
    setStatus("API response received successfully.", "ok");
  } catch (error) {
    setStatus(`API error: ${error.message}`, "error");
    summaryBox.innerHTML = "";
    hierarchyBox.innerHTML = "";
    rawJson.textContent = "";
  } finally {
    submitBtn.disabled = false;
  }
});
