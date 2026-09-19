# Platform Rules

Checked on 2026-09-17 for the weekly autopilot build.

## Sources

- Publer API network reference: https://publer.com/docs/posting/create-posts/networks
- Publer API content types: https://publer.com/docs/create-posts/content-types
- YouTube Help, three-minute Shorts: https://support.google.com/youtube/answer/15424877

## Applied Rules

| Platform | Rule in RX Studio | Source note |
|---|---|---|
| Instagram | Caption limit 2,200. Carousel/photo support up to 10 media. Reels remain 3-90 seconds for Publer API compatibility. Hashtags are configured at 3-5 and kept in the first comment. | Publer lists 2,200 chars, up to 10 carousel items, and Reels 3-90 seconds. |
| YouTube | Title <=100 chars. Description target 200-400 words. Tags <=500 chars. Vertical or square videos up to 180 seconds are treated as Shorts. | Publer lists title 100 chars and tags 500 chars; YouTube Help says Shorts up to three minutes for eligible uploads. |
| Facebook | Limit 10,000 chars; RX Studio recommends 300-600 chars and 2-4 hashtags in prompts. Videos are allowed by Publer up to 240 minutes. | Publer lists Facebook status/photo/video/link/carousel and 10,000 chars. |
| LinkedIn | Limit 3,000 chars; RX Studio prompts for 800-1300 chars, line breaks and 3-5 hashtags. | Publer lists LinkedIn status/photo/video/link/document/polls and 3,000 chars. |
| Pinterest | Description <=500 chars, title <=100 in RX validation, board required, CTA link used as URL. | Publer lists Pinterest photo/video, 500 chars, no text-only posts, board selection required. |
| Google Business | Limit 1,500 chars. RX Studio uses LEARN_MORE with URL, requires photo for weekly planner unless text-only support is chosen manually, and blocks phone numbers through prompt rules. | Publer lists Google Business status/photo/video/link, 1,500 chars, CTA buttons. |
| X / Threads / TikTok | Kept in config but disabled by default for weekly channels. | Publer lists support, but the owner requested these disabled by default. |

## Product Decisions

The weekly planner allows text-only slots only for networks where Publer lists `status` support: Facebook, LinkedIn, X and Threads. Pinterest and YouTube require compatible media. Google is planned with images or cover frames because this workflow is meant for visual local updates.

Instagram hashtags are configured as 3-5. The task mentioned a reported late-2025 five-hashtag cap, but I did not find an official Instagram Help page in the available search results confirming that exact cap. The conservative 3-5 range is still applied.
