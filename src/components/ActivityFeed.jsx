import { useMemo } from "react";
import { USERNAME } from "../lib/github";
import { formatNumber, relativeTime, toKey } from "../lib/stats";
import { Card, CardHeader, Icon } from "./ui";

const shortRepo = (name = "") => name.replace(`${USERNAME}/`, "");
const branchOf = (ref = "") => ref.replace("refs/heads/", "");
const cap = (s = "") => s.charAt(0).toUpperCase() + s.slice(1);

/** Turn a raw GitHub event into something readable. */
function describeEvent(e) {
  const p = e.payload || {};
  const repoUrl = `https://github.com/${e.repo?.name}`;
  const pr = p.pull_request || {};
  const issue = p.issue || {};
  switch (e.type) {
    case "PushEvent":
      return {
        icon: "commit", kind: "Push", verb: `Pushed to ${branchOf(p.ref)}`,
        detail: p.head ? p.head.slice(0, 7) : null,
        href: p.head ? `${repoUrl}/commit/${p.head}` : repoUrl,
      };
    case "PullRequestEvent": {
      const action = p.action === "closed" && pr.merged ? "Merged" : cap(p.action);
      return { icon: "pr", kind: "Pull request", verb: `${action} PR #${p.number ?? pr.number ?? ""}`, detail: pr.title, href: pr.html_url || `${repoUrl}/pulls` };
    }
    case "PullRequestReviewEvent":
      return { icon: "pr", kind: "Review", verb: `Reviewed PR #${pr.number ?? ""}`, detail: pr.title, href: pr.html_url || repoUrl };
    case "IssuesEvent":
      return { icon: "issue", kind: "Issue", verb: `${cap(p.action)} issue #${issue.number ?? ""}`, detail: issue.title, href: issue.html_url || repoUrl };
    case "IssueCommentEvent":
      return { icon: "comment", kind: "Comment", verb: `Commented on #${issue.number ?? ""}`, detail: issue.title, href: p.comment?.html_url || repoUrl };
    case "CreateEvent":
      return {
        icon: p.ref_type === "repository" ? "repo" : p.ref_type === "tag" ? "tag" : "branch",
        kind: "Create",
        verb: p.ref_type === "repository" ? "Created repository" : `Created ${p.ref_type} ${p.ref}`,
        detail: p.ref_type === "repository" ? p.description : null,
        href: repoUrl,
      };
    case "DeleteEvent":
      return { icon: "trash", kind: "Delete", verb: `Deleted ${p.ref_type} ${p.ref}`, href: repoUrl };
    case "WatchEvent":
      return { icon: "star", kind: "Star", verb: "Starred", href: repoUrl };
    case "ForkEvent":
      return { icon: "fork", kind: "Fork", verb: "Forked", href: p.forkee?.html_url || repoUrl };
    case "MemberEvent":
      return { icon: "person", kind: "Collaborator", verb: `Added ${p.member?.login ?? "a collaborator"} to`, href: repoUrl };
    case "ReleaseEvent":
      return { icon: "tag", kind: "Release", verb: `Released ${p.release?.tag_name ?? ""}`, detail: p.release?.name, href: p.release?.html_url || repoUrl };
    case "PublicEvent":
      return { icon: "repo", kind: "Publish", verb: "Open-sourced", href: repoUrl };
    default:
      return { icon: "link", kind: e.type.replace("Event", ""), verb: e.type.replace("Event", ""), href: repoUrl };
  }
}

function dayHeading(key) {
  const today = toKey(new Date());
  const yesterday = toKey(new Date(Date.now() - 86_400_000));
  if (key === today) return "Today";
  if (key === yesterday) return "Yesterday";
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

export default function ActivityFeed({ events }) {
  const { groups, byRepo, byKind, spanDays } = useMemo(() => {
    const groups = [];
    const byRepo = new Map();
    const byKind = new Map();
    // The events API isn't strictly time-ordered, so sort before grouping by day.
    const sorted = [...events].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    for (const e of sorted) {
      const info = describeEvent(e);
      const key = toKey(new Date(e.created_at));
      if (groups.at(-1)?.key !== key) groups.push({ key, items: [] });
      const items = groups.at(-1).items;
      const prev = items.at(-1);
      // Collapse back-to-back pushes to the same branch into one row.
      if (e.type === "PushEvent" && prev?.e.type === "PushEvent" && prev.e.repo?.name === e.repo?.name && prev.e.payload?.ref === e.payload?.ref) {
        prev.pushes += 1;
      } else {
        items.push({ e, info, pushes: 1 });
      }
      const repo = shortRepo(e.repo?.name);
      byRepo.set(repo, (byRepo.get(repo) || 0) + 1);
      byKind.set(info.kind, (byKind.get(info.kind) || 0) + 1);
    }
    const oldest = sorted.at(-1)?.created_at;
    const spanDays = oldest ? Math.max(1, Math.ceil((Date.now() - new Date(oldest)) / 86_400_000)) : 0;
    const sortDesc = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]);
    return { groups, byRepo: sortDesc(byRepo), byKind: sortDesc(byKind), spanDays };
  }, [events]);

  if (!events.length) {
    return (
      <Card index={1}>
        <CardHeader eyebrow="Activity" title="Recent activity" />
        <p className="text-sm text-muted">No public activity in the last 90 days.</p>
      </Card>
    );
  }

  const maxRepo = byRepo[0][1];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start">
      <Card index={1} className="lg:col-span-2">
        <CardHeader
          eyebrow="Activity"
          title="Recent public activity"
          subtitle={`${events.length} events across ${byRepo.length} repos in the last ${spanDays} days`}
        />
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.key}>
              <h3 className="eyebrow mb-2">{dayHeading(g.key)}</h3>
              <ol className="relative space-y-1 before:absolute before:top-3 before:bottom-3 before:left-[15px] before:w-px before:bg-[var(--grid)]">
                {g.items.map(({ e, info, pushes }) => (
                  <li key={e.id}>
                    <a href={info.href} target="_blank" rel="noreferrer" className="relative flex items-start gap-3 rounded-xl py-2 pr-2 transition-colors hover:bg-surface-2">
                      <span className="z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface text-ink-2 ring-1 ring-line">
                        <Icon name={info.icon} size={14} />
                      </span>
                      <div className="min-w-0 flex-1 pt-1">
                        <p className="text-sm">
                          <span className="text-ink-2">{pushes > 1 ? info.verb.replace("Pushed", `Pushed ${pushes}×`) : info.verb}</span>{" "}
                          <span className="font-semibold">{shortRepo(e.repo?.name)}</span>
                        </p>
                        {info.detail && <p className="truncate font-mono text-xs text-muted">{pushes > 1 ? `latest ${info.detail}` : info.detail}</p>}
                      </div>
                      <span className="shrink-0 pt-1.5 font-mono text-[11px] text-muted" title={new Date(e.created_at).toLocaleString()}>
                        {relativeTime(e.created_at)}
                      </span>
                    </a>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      </Card>

      <div className="space-y-4">
        <Card index={2}>
          <CardHeader eyebrow="Focus" title="Where the work went" subtitle="Public events per repo" />
          <ul className="space-y-3">
            {byRepo.slice(0, 8).map(([repo, n]) => (
              <li key={repo}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="truncate font-medium">{repo}</span>
                  <span className="font-mono text-xs tabular-nums text-ink-2">{formatNumber(n)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-[var(--series-1)]" style={{ width: `${(n / maxRepo) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card index={3}>
          <CardHeader eyebrow="Mix" title="Event types" />
          <ul className="divide-y divide-line">
            {byKind.map(([kind, n]) => (
              <li key={kind} className="flex justify-between py-2 text-sm first:pt-0 last:pb-0">
                <span className="text-ink-2">{kind}</span>
                <span className="font-mono tabular-nums">{n}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
