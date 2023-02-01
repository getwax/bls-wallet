# Contribute to BLS Wallet

Thank for taking the time to contribute to BLS Wallet!

In this guide you will get an overview of the contribution workflow from opening an issue, creating a PR, reviewing, and merging the PR.

## Getting started

To get an overview of the project, see [System Overview](docs/system_overview.md)

To setup the repo for local use, see [Local Development](docs/local_development.md)

## Issues

### Create a new issue

First search for an [existing issue](https://github.com/web3well/bls-wallet/issues). If you find one, add any new insight, helpful context, or some reactions. Otherwise, you can [open a new issue](https://github.com/web3well/bls-wallet/issues/new). Be sure to label it with anything relevant.

### Solve an issue

Search for a [existing issue](https://github.com/github/docs/issues) that is unassigned and interests you. If this is your first time contributing, you may want to choose a [good first issue](https://github.com/web3well/bls-wallet/issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22).

## Make Changes

1. [Fork the repo](https://github.com/web3well/bls-wallet/fork)
2. Checkout a new branch
3. Make your changes

### Quality Checks

- You should add new/update test cases for new features or bug fixes to ensure that your changes work properly and will not be broken by other future changes.
- Type checking and code linting should all pass.
- For ambiguous Typescript typing, prefer `unknown` over `any`.

## Commit your update

Commit your changes over one or more commits. It is recommend your format your commit messages as follows:

```
A short summary of what you did

A list or paragraph of more specific details
```

## Pull Request

Create a pull request (PR) from your fork's branch to `main`, filling in the descriptions template including [linking to the issue you are resolving](https://docs.github.com/en/issues/tracking-your-work-with-issues/linking-a-pull-request-to-an-issue). Feel free to open a draft PR while you are actively working.

Once ready, a BLS Wallet team member will review the PR.

- When run, all Github Actions workflows should succeed.
- All TODO/FIXME comments in code should be resolved, unless marked `merge-ok` with a description/issue link describing how they can be resolved in future work.
- The author of a comment may mark it as [resolved](https://docs.github.com/en/github/collaborating-with-issues-and-pull-requests/commenting-on-a-pull-request#resolving-conversations) when they are satisified with a requested change or answer to a question. You are not required to resolve all comments as some may provide good historical information.

## Your PR is merged!

Thanks for your hard work! Accept our heartfelt graditiude and revel in your masterful coding and/or documentational skills.

### Thanks

To [github/docs CONTRIBUTING.md](https://github.com/github/docs/blob/main/CONTRIBUTING.md) for being a great contribution template.
