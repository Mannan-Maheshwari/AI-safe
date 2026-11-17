# Agent Shield evaluation dataset (starter set)

`attacks.json` (12 cases) and `benign.json` (6 cases) follow the record format in SRS section 13.3.
The SRS asks for 100 attack cases and about 50 legitimate cases. Extend these files by hand and
review every Gemini-generated variation before adding it (remove duplicates, verify labels, keep a version note).

Targets for the final report: attack success rate, unauthorized execution rate, detection rate,
false positive rate, task completion rate and gateway latency, compared across E1-E4 (SRS 14.7).
The Attack Simulator page already reports these for the built-in scenarios.
