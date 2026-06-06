"""Tests for JWT auth, user registration/login, and project membership."""
import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("FRONTEND_URL", "http://localhost:5173")

from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture()
def auth_engine():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture()
def AuthSessionFactory(auth_engine):
    return sessionmaker(autocommit=False, autoflush=False, bind=auth_engine)


@pytest.fixture()
def auth_client(AuthSessionFactory):
    def override_get_db():
        db = AuthSessionFactory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    # Do NOT override get_current_user — this fixture tests real auth
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


def _reg_login(c, email="a@test.com", pw="pw123", name="A"):
    c.post("/auth/register", json={"email": email, "password": pw, "name": name})
    r = c.post("/auth/login", data={"username": email, "password": pw})
    return r.json()["access_token"]


# ── Test 1: Register returns 201 with id/email/name ──────────────────────────

def test_register_201(auth_client):
    r = auth_client.post("/auth/register", json={"email": "b@test.com", "password": "pw123", "name": "Bob"})
    assert r.status_code == 201
    data = r.json()
    assert data["email"] == "b@test.com"
    assert data["name"] == "Bob"
    assert "id" in data
    assert "password" not in data


# ── Test 2: Duplicate email returns 409 ──────────────────────────────────────

def test_register_duplicate_409(auth_client):
    auth_client.post("/auth/register", json={"email": "dup@test.com", "password": "pw123", "name": "A"})
    r = auth_client.post("/auth/register", json={"email": "dup@test.com", "password": "pw456", "name": "B"})
    assert r.status_code == 409


# ── Test 3: Login valid returns 200 with access_token ────────────────────────

def test_login_valid(auth_client):
    auth_client.post("/auth/register", json={"email": "c@test.com", "password": "pw123", "name": "C"})
    r = auth_client.post("/auth/login", data={"username": "c@test.com", "password": "pw123"})
    assert r.status_code == 200
    data = r.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


# ── Test 4: Login wrong password returns 401 ─────────────────────────────────

def test_login_wrong_password_401(auth_client):
    auth_client.post("/auth/register", json={"email": "d@test.com", "password": "pw123", "name": "D"})
    r = auth_client.post("/auth/login", data={"username": "d@test.com", "password": "wrong"})
    assert r.status_code == 401


# ── Test 5: Login unknown email returns 401 ───────────────────────────────────

def test_login_unknown_email_401(auth_client):
    r = auth_client.post("/auth/login", data={"username": "nobody@test.com", "password": "pw123"})
    assert r.status_code == 401


# ── Test 6: GET /auth/me with valid token returns 200 ────────────────────────

def test_me_valid_token(auth_client):
    token = _reg_login(auth_client, email="e@test.com")
    r = auth_client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["email"] == "e@test.com"


# ── Test 7: GET /auth/me no token returns 401 or 422 ─────────────────────────

def test_me_no_token(auth_client):
    r = auth_client.get("/auth/me")
    assert r.status_code in (401, 422)


# ── Test 8: GET /auth/me bad token returns 401 ───────────────────────────────

def test_me_bad_token_401(auth_client):
    r = auth_client.get("/auth/me", headers={"Authorization": "Bearer thisisnotvalid"})
    assert r.status_code == 401


# ── Test 9: POST /projects → 201, user is owner ──────────────────────────────

def test_create_project_owner(auth_client):
    token = _reg_login(auth_client, email="f@test.com")
    r = auth_client.post(
        "/projects",
        json={"name": "My Project", "location_city": "NYC", "latitude": 40.7, "longitude": -74.0},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 201
    project_id = r.json()["id"]

    # Verify user can GET the project (must be a member)
    r2 = auth_client.get(f"/projects/{project_id}", headers={"Authorization": f"Bearer {token}"})
    assert r2.status_code == 200


# ── Test 10: Non-member GET /projects/{id} returns 403 ───────────────────────

def test_non_member_get_project_403(auth_client):
    # Owner creates project
    owner_token = _reg_login(auth_client, email="owner@test.com", name="Owner")
    r = auth_client.post(
        "/projects",
        json={"name": "Private Project", "location_city": "NYC", "latitude": 40.7, "longitude": -74.0},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    project_id = r.json()["id"]

    # Another user tries to access it
    other_token = _reg_login(auth_client, email="other@test.com", name="Other")
    r2 = auth_client.get(f"/projects/{project_id}", headers={"Authorization": f"Bearer {other_token}"})
    assert r2.status_code == 403


# ── Test 11: Add member → member can GET /projects/{id} ─────────────────────

def test_add_member_can_access(auth_client):
    owner_token = _reg_login(auth_client, email="owner2@test.com", name="Owner2")
    r = auth_client.post(
        "/projects",
        json={"name": "Shared Project", "location_city": "LA", "latitude": 34.0, "longitude": -118.0},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    project_id = r.json()["id"]

    # Register new member
    auth_client.post("/auth/register", json={"email": "member@test.com", "password": "pw123", "name": "Member"})

    # Owner adds member
    r_add = auth_client.post(
        f"/projects/{project_id}/members",
        json={"email": "member@test.com", "role": "member"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert r_add.status_code == 201

    # Member logs in and accesses project
    member_token = auth_client.post("/auth/login", data={"username": "member@test.com", "password": "pw123"}).json()["access_token"]
    r2 = auth_client.get(f"/projects/{project_id}", headers={"Authorization": f"Bearer {member_token}"})
    assert r2.status_code == 200


# ── Test 12: Non-owner DELETE /projects/{id} returns 403 ─────────────────────

def test_non_owner_delete_project_403(auth_client):
    owner_token = _reg_login(auth_client, email="owner3@test.com", name="Owner3")
    r = auth_client.post(
        "/projects",
        json={"name": "Protected Project", "location_city": "SF", "latitude": 37.7, "longitude": -122.4},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    project_id = r.json()["id"]

    # Register a member (not owner)
    auth_client.post("/auth/register", json={"email": "member2@test.com", "password": "pw123", "name": "Member2"})
    auth_client.post(
        f"/projects/{project_id}/members",
        json={"email": "member2@test.com", "role": "member"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    member_token = auth_client.post("/auth/login", data={"username": "member2@test.com", "password": "pw123"}).json()["access_token"]

    r_del = auth_client.delete(f"/projects/{project_id}", headers={"Authorization": f"Bearer {member_token}"})
    assert r_del.status_code == 403
