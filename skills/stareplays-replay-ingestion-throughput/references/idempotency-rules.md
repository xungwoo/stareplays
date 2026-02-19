# Idempotency Rules

- same replay hash + same uploader + same game => reject duplicate upload (409).
- same replay hash + different uploader => increase reliability only.
- same game key (host + start_time) + new uploader => append replay file and increment upload_count.
- uploader must be one of non-observer players.

Always preserve these rules when optimizing.
