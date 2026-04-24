const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const EDGE_REGEX = /^[A-Z]->[A-Z]$/;

function parseEdge(entry) {
  const [parent, child] = entry.split("->");
  return { parent, child };
}

function buildNestedTree(node, adjacency) {
  const children = adjacency.get(node) || [];
  const childObj = {};

  for (const child of children) {
    childObj[child] = buildNestedTree(child, adjacency);
  }

  return childObj;
}

function getDepth(root, adjacency) {
  const children = adjacency.get(root) || [];
  if (children.length === 0) return 1;

  let maxChildDepth = 0;
  for (const child of children) {
    maxChildDepth = Math.max(maxChildDepth, getDepth(child, adjacency));
  }
  return 1 + maxChildDepth;
}

function processData(entries) {
  const invalidEntries = [];
  const duplicateEdges = [];
  const validEdges = [];
  const seenEdgeSet = new Set();
  const reportedDuplicateSet = new Set();

  for (const rawValue of entries) {
    const normalized = String(rawValue ?? "").trim();

    if (!EDGE_REGEX.test(normalized)) {
      invalidEntries.push(normalized);
      continue;
    }

    const { parent, child } = parseEdge(normalized);
    if (parent === child) {
      invalidEntries.push(normalized);
      continue;
    }

    if (seenEdgeSet.has(normalized)) {
      if (!reportedDuplicateSet.has(normalized)) {
        duplicateEdges.push(normalized);
        reportedDuplicateSet.add(normalized);
      }
      continue;
    }

    seenEdgeSet.add(normalized);
    validEdges.push({ parent, child, raw: normalized });
  }

  const childToParent = new Map();
  const filteredEdges = [];
  for (const edge of validEdges) {
    if (childToParent.has(edge.child)) {
      continue;
    }
    childToParent.set(edge.child, edge.parent);
    filteredEdges.push(edge);
  }

  const adjacency = new Map();
  const nodes = new Set();
  for (const { parent, child } of filteredEdges) {
    if (!adjacency.has(parent)) adjacency.set(parent, []);
    if (!adjacency.has(child)) adjacency.set(child, []);
    adjacency.get(parent).push(child);
    nodes.add(parent);
    nodes.add(child);
  }

  const undirected = new Map();
  for (const node of nodes) undirected.set(node, new Set());
  for (const { parent, child } of filteredEdges) {
    undirected.get(parent).add(child);
    undirected.get(child).add(parent);
  }

  const components = [];
  const visitedUndirected = new Set();

  for (const node of nodes) {
    if (visitedUndirected.has(node)) continue;
    const queue = [node];
    visitedUndirected.add(node);
    const componentNodes = [];

    while (queue.length) {
      const current = queue.shift();
      componentNodes.push(current);

      for (const next of undirected.get(current) || []) {
        if (!visitedUndirected.has(next)) {
          visitedUndirected.add(next);
          queue.push(next);
        }
      }
    }

    components.push(componentNodes.sort());
  }

  const hierarchies = [];
  let totalTrees = 0;
  let totalCycles = 0;
  let largestTreeRoot = "";
  let largestDepth = 0;

  for (const component of components) {
    const compSet = new Set(component);
    const candidateRoots = component.filter((node) => !childToParent.has(node));
    const root = candidateRoots.length
      ? candidateRoots.sort()[0]
      : [...component].sort()[0];

    let hasCycle = false;
    const visitState = new Map();
    for (const node of component) visitState.set(node, 0);

    function dfs(node) {
      visitState.set(node, 1);
      for (const child of adjacency.get(node) || []) {
        if (!compSet.has(child)) continue;
        const state = visitState.get(child);
        if (state === 1) return true;
        if (state === 0 && dfs(child)) return true;
      }
      visitState.set(node, 2);
      return false;
    }

    for (const node of component) {
      if (visitState.get(node) === 0 && dfs(node)) {
        hasCycle = true;
        break;
      }
    }

    if (hasCycle) {
      totalCycles += 1;
      hierarchies.push({
        root,
        tree: {},
        has_cycle: true,
      });
    } else {
      totalTrees += 1;
      const tree = { [root]: buildNestedTree(root, adjacency) };
      const depth = getDepth(root, adjacency);
      hierarchies.push({
        root,
        tree,
        depth,
      });

      const rootIsBetter =
        depth > largestDepth ||
        (depth === largestDepth && (largestTreeRoot === "" || root < largestTreeRoot));

      if (rootIsBetter) {
        largestDepth = depth;
        largestTreeRoot = root;
      }
    }
  }

  hierarchies.sort((a, b) => a.root.localeCompare(b.root));

  return {
    hierarchies,
    invalidEntries,
    duplicateEdges,
    summary: {
      total_trees: totalTrees,
      total_cycles: totalCycles,
      largest_tree_root: largestTreeRoot,
    },
  };
}

app.post("/bfhl", (req, res) => {
  const { data } = req.body || {};

  if (!Array.isArray(data)) {
    return res.status(400).json({
      is_success: false,
      message: "Request body must include a 'data' array.",
    });
  }

  const processed = processData(data);
  return res.json({
    user_id: "manikanta_24042026",
    email_id: "manikanta@example.edu",
    college_roll_number: "ROLL12345",
    hierarchies: processed.hierarchies,
    invalid_entries: processed.invalidEntries,
    duplicate_edges: processed.duplicateEdges,
    summary: processed.summary,
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  // Keep startup log simple for platforms like Render/Railway.
  console.log(`Server running on http://localhost:${PORT}`);
});
