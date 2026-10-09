T={
'H1 title':"Know when the budget runs out, before it does",
'H1 desc':"Burn rate and a 14-day forecast show the date a project budget will be used up, while there is still time to act. The Budget risk gadget ranks your projects by overrun risk. Forecast and gadget: Advanced.",
'H2 title':"Real cost and margin from the worklogs you have",
'H2 desc':"Native Jira worklogs × rate cards (global, role, user, project, dated history) give cost, billable revenue and margin per project, epic and issue. Import past worklogs and get numbers on day one.",
'H3 title':"Ask Rovo. Your data never leaves Atlassian",
'H3 desc':"Ask the MarginRadar Rovo agent which projects will overrun or what an epic costs. Runs on Atlassian: no egress, data stays in Atlassian. Role-based visibility lets Finance decide who sees rates.",
'H3alt title':"Catch epic overruns while you can still act",
'H3alt desc':"Give each epic its own budget and see spend next to delivery progress. Epics over budget are flagged Critical with % used, so you can fix scope or staffing early. Epic budgets: Advanced.",
'summary':"First public release: budgets, cost, margin and alerts from Jira worklogs",
'notes':"""First public release of MarginRadar on the Atlassian Marketplace.

Standard (free for up to 10 users):
• Money or hours budgets per project, with spent, remaining, % used and burn per day
• Cost from native Jira worklogs × rate cards (global, role, user, project, effective-dated)
• Billable revenue and margin per project, epic and issue
• Worklog history import, so existing projects show numbers on day one
• In-app alerts at configurable warning and critical thresholds
• Issue and epic panel, CSV export, light and dark theme
• Role-based visibility, audit log and in-app data deletion

Advanced:
• 14-day burn forecast with run-out date and estimate at completion
• Epic budgets and fixed-price revenue
• Budget risk dashboard gadget
• Alerts as Jira comments (opt-in) and the MarginRadar Rovo agent (requires Rovo)

Runs on Atlassian: no data egress, data follows your site's data residency."""}
for k,v in T.items(): print(f'{k} [{len(v)}]: {v}\n')
