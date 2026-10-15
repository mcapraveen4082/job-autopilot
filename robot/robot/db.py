"""Tiny Supabase REST client (uses the service role key, so it bypasses RLS)."""
import os
import requests


class DB:
    def __init__(self):
        self.url = os.environ["SUPABASE_URL"].rstrip("/")
        key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        self.h = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}

    def _rest(self, table):
        return f"{self.url}/rest/v1/{table}"

    def select(self, table, params):
        r = requests.get(self._rest(table), headers=self.h, params=params, timeout=30)
        r.raise_for_status()
        return r.json()

    def one(self, table, params):
        rows = self.select(table, {**params, "limit": 1})
        return rows[0] if rows else None

    def count(self, table, params):
        h = {**self.h, "Prefer": "count=exact", "Range": "0-0"}
        r = requests.get(self._rest(table), headers=h, params={**params, "select": "id"}, timeout=30)
        r.raise_for_status()
        total = r.headers.get("Content-Range", "*/0").split("/")[-1]
        return int(total) if total.isdigit() else 0

    def insert(self, table, rows, on_conflict=None, ignore_duplicates=False, merge=False):
        prefer = ["return=representation"]
        if ignore_duplicates:
            prefer.append("resolution=ignore-duplicates")
        elif merge:
            prefer.append("resolution=merge-duplicates")
        params = {"on_conflict": on_conflict} if on_conflict else {}
        r = requests.post(self._rest(table), headers={**self.h, "Prefer": ",".join(prefer)},
                          params=params, json=rows, timeout=30)
        r.raise_for_status()
        return r.json() if r.text else []

    def update(self, table, filters, patch):
        r = requests.patch(self._rest(table), headers={**self.h, "Prefer": "return=minimal"},
                           params=filters, json=patch, timeout=30)
        r.raise_for_status()

    def download(self, bucket, path):
        r = requests.get(f"{self.url}/storage/v1/object/{bucket}/{path}", headers=self.h, timeout=60)
        r.raise_for_status()
        return r.content
