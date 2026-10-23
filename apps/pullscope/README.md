# Pullscope

A local-first Electron dashboard for pull requests authored by you across a Bitbucket Cloud workspace.

## Features

- Add local Git repository folders and find merged PRs whose source branch still exists locally.
- Filter branches without an open PR by their latest commit author.
- Choose which installed browser opens Bitbucket links.
- Review approvals and requested changes from detailed pull-request data.
- Render long result sets in batches of 10.

- Draft, open, and merged pull requests in one searchable view
- Repository filter and sorting by activity, creation date, or title
- Comment, approval, and change-request counts
- Light and dark themes
- Encrypted local credential storage through Electron `safeStorage`
- JSON cache for fast startup and offline history; no database
- External links restricted to `https://bitbucket.org`

## Run locally

```bash
npm install
npm run dev
```

Build the frontend with `npm run build`, or create an installer with `npm run dist`.

## Bitbucket connection

Create an API token in your Atlassian account and grant these Bitbucket scopes:

- User data: Read (`read:user:bitbucket`)
- Repositories: Read
- Pull requests: Read

In Pullscope, open **Connection** and enter your workspace slug and token. Pullscope authenticates the API token as a Bearer token and only performs `GET` requests. The token is encrypted using the operating system's credential protection and never enters the React renderer or the cache.

Pullscope currently targets **Bitbucket Cloud**. A workspace slug is the part after `bitbucket.org/` in a workspace URL.
