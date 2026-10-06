# Codex for Open Source application — factual draft

> 提交前由项目负责人和 GPT 复核；不要把本文件当作已提交申请。

## Project

WeChat Content Copilot is an open-source, human-reviewed content workflow for WeChat Official Account operators and small teams. It turns a topic, audience and editorial constraints into a structured Chinese article, digest, cover asset and WeChat-ready HTML. Operators can inspect local artifacts before optionally saving them to the platform's draft box; the project never auto-publishes.

## Problem and ecosystem value

Small Chinese-language content teams often move manually between topic queues, writing tools, image tools and the WeChat editor. This project provides a reproducible local workflow with explicit review gates, staged persistence and retry-safe draft delivery. Its intended value is to make responsible content automation easier to inspect, test and adapt without coupling publication to generation.

## Current evidence

- A working local MVP exists with a browser UI, brand and source-material constraints, structured generation, alternate titles, layout guidance, cover rendering, topic scheduling and optional WeChat draft creation.
- Automated tests cover generation constraints, failure handling, output rendering, queue transitions and the WeChat draft sequence.
- The repository includes contributor, security, privacy, architecture and roadmap documentation plus continuous integration.
- No claims are made about Stars, downloads, external users, adoption or production usage.

## Maintenance plan

The maintainer plans to triage reproducible issues, review focused pull requests, publish transparent changelog entries and prioritize security, human review, provider portability and failure recovery. Early public feedback will determine the first post-MVP milestones.

## How Codex would help

Codex would be used for issue triage, test expansion, pull request review, security-oriented maintenance, provider adapter work and release preparation. API credits, if awarded, would support maintainer automation and reproducible evaluation work rather than fabricated usage or marketing claims.

## Honest limitations to retain in the application

- This is a new public open-source project and does not yet have demonstrated broad adoption.
- Local demo behavior and automated tests are verified; real WeChat integration depends on each operator's account permissions, IP allowlist and credentials.
- Generated content still requires human fact, copyright, brand and compliance review.
