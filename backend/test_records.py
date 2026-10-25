import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.storage import connection

PASSWORD = "OnlyForTests123!"
PDF = b"%PDF-1.4\n%test\n"
PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 16


class RecordTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.env = patch.dict(os.environ, {"CARECOMPASS_DB_PATH": str(Path(self.directory.name) / "records.sqlite3")})
        self.env.start()
        self.client = TestClient(app)
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.env.stop()
        self.directory.cleanup()

    def register(self, email="one@example.com"):
        response = self.client.post("/api/auth/register", json={"email": email, "name": "Test Person", "password": PASSWORD})
        self.assertEqual(response.status_code, 201, response.text)

    def upload(self, data=PDF, kind="report", name="lab.pdf"):
        return self.client.post(f"/api/account/documents?kind={kind}&filename={name}", content=data)

    def test_extended_profile_fields_persist_and_validate(self):
        self.register()
        profile = self.client.get("/api/account").json()["profile"]
        self.assertEqual(profile["bloodGroup"], "")
        profile.update(phone="+91 91259 00756", dateOfBirth="2005-08-04", gender="male", bloodGroup="O+",
                       allergies="Penicillin", pastHistory="Asthma", currentMedications="Inhaler", familyHistory="Diabetes")
        self.assertEqual(self.client.put("/api/account/profile", json=profile).status_code, 200)
        self.client.post("/api/auth/logout")
        data = self.client.post("/api/auth/login", json={"email": "one@example.com", "password": PASSWORD}).json()
        self.assertEqual(data["profile"], profile)
        for bad in ({"dateOfBirth": "2005-02-30"}, {"dateOfBirth": "2999-01-01"}, {"gender": "x"},
                    {"bloodGroup": "Z+"}, {"phone": "abc"}, {"allergies": "a" * 1001}):
            self.assertEqual(self.client.put("/api/account/profile", json={**profile, **bad}).status_code, 422, bad)

    def test_old_profiles_without_new_fields_still_save(self):
        self.register()
        response = self.client.put("/api/account/profile", json={"email": "one@example.com", "name": "Only Basics"})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["gender"], "")

    def test_tickets_are_private_and_validated(self):
        self.register()
        self.assertEqual(self.client.post("/api/account/tickets", json={"subject": "hi", "message": "x"}).status_code, 422)
        created = self.client.post("/api/account/tickets", json={"category": "billing", "subject": "Refund help", "message": "Charged twice"})
        self.assertEqual(created.status_code, 201, created.text)
        self.assertEqual(created.json()["status"], "open")
        self.assertEqual(len(self.client.get("/api/account/tickets").json()), 1)
        self.client.post("/api/auth/logout")
        self.assertEqual(self.client.get("/api/account/tickets").status_code, 401)
        self.register("two@example.com")
        self.assertEqual(self.client.get("/api/account/tickets").json(), [])

    def test_documents_upload_download_isolation_and_delete(self):
        self.register()
        created = self.upload()
        self.assertEqual(created.status_code, 201, created.text)
        document = created.json()
        self.assertEqual(document["contentType"], "application/pdf")
        self.assertEqual(self.upload(PNG, "prescription", "../../rx.png").json()["filename"], "rx.png")
        self.assertEqual(len(self.client.get("/api/account/documents?kind=report").json()), 1)
        download = self.client.get("/api/account/documents/" + document["id"])
        self.assertEqual(download.content, PDF)
        self.assertEqual(download.headers["x-content-type-options"], "nosniff")
        self.assertIn("attachment", download.headers["content-disposition"])
        self.client.post("/api/auth/logout")
        self.register("two@example.com")
        self.assertEqual(self.client.get("/api/account/documents/" + document["id"]).status_code, 404)
        self.assertEqual(self.client.delete("/api/account/documents/" + document["id"]).status_code, 404)
        self.client.post("/api/auth/logout")
        self.client.post("/api/auth/login", json={"email": "one@example.com", "password": PASSWORD})
        self.assertEqual(self.client.delete("/api/account/documents/" + document["id"]).status_code, 204)

    def test_documents_reject_wrong_type_size_and_unknown_kind(self):
        self.register()
        self.assertEqual(self.upload(b"<script>alert(1)</script>", name="x.pdf").status_code, 415)
        self.assertEqual(self.upload(PDF + b"0" * (5 * 1024 * 1024)).status_code, 413)
        self.assertEqual(self.upload(kind="other").status_code, 422)

    def test_delete_account_requires_password_and_removes_everything(self):
        self.register()
        self.upload()
        self.client.post("/api/account/tickets", json={"subject": "Question", "message": "Hello"})
        wrong = self.client.request("DELETE", "/api/account", json={"password": "wrong-password"})
        self.assertEqual(wrong.status_code, 401)
        self.assertEqual(self.client.get("/api/account").status_code, 200)
        self.assertEqual(self.client.request("DELETE", "/api/account", json={"password": PASSWORD}).status_code, 204)
        self.assertEqual(self.client.get("/api/account").status_code, 401)
        with connection() as db:
            for table in ("users", "profiles", "sessions", "documents", "support_tickets"):
                count = db.execute(f"SELECT COUNT(*) FROM {table} WHERE user_id != '00000000-0000-0000-0000-000000000001'" if table != "users"
                                   else "SELECT COUNT(*) FROM users WHERE email='one@example.com'").fetchone()[0]
                self.assertEqual(count, 0, table)
        self.client.cookies.clear()
        self.assertEqual(self.client.post("/api/auth/login", json={"email": "one@example.com", "password": PASSWORD}).status_code, 401)


if __name__ == "__main__":
    unittest.main()
