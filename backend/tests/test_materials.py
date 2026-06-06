"""
Functional Tests: Materials Used (Feature 4)
Coverage:
  - List on non-existent log → 404
  - List on empty log → []
  - Create with all fields → 201
  - Create with required fields only → 201, notes null
  - Create missing required field → 422
  - Create with non-numeric quantity → 422
  - Quantity stored as float, returned correctly
  - Create on non-existent log → 404
  - Created material appears in list
  - Delete existing → 204, removed from list
  - Delete non-existent → 404
  - Delete material from wrong log → 404
"""

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_material(client, log_id: int, **kwargs) -> dict:
    payload = {
        "material_name": "Concrete",
        "quantity": 10.0,
        "unit": "m³",
        **kwargs,
    }
    resp = client.post(f"/daily-logs/{log_id}/materials", json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


# ---------------------------------------------------------------------------
# List materials
# ---------------------------------------------------------------------------

class TestListMaterials:
    def test_nonexistent_log_returns_404(self, client):
        resp = client.get("/daily-logs/9999/materials")
        assert resp.status_code == 404

    def test_empty_log_returns_empty_list(self, seeded_client):
        resp = seeded_client.get(f"/daily-logs/{seeded_client.log_id}/materials")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_created_material_appears_in_list(self, seeded_client):
        log_id = seeded_client.log_id
        _create_material(seeded_client, log_id)
        resp = seeded_client.get(f"/daily-logs/{log_id}/materials")
        assert resp.status_code == 200
        assert len(resp.json()) == 1


# ---------------------------------------------------------------------------
# Create material
# ---------------------------------------------------------------------------

class TestCreateMaterial:
    def test_create_with_all_fields_returns_201(self, seeded_client):
        log_id = seeded_client.log_id
        payload = {
            "material_name": "Steel rebar",
            "quantity": 25.5,
            "unit": "kg",
            "notes": "Grade 60, 12mm diameter",
        }
        resp = seeded_client.post(f"/daily-logs/{log_id}/materials", json=payload)
        assert resp.status_code == 201
        body = resp.json()
        assert body["material_name"] == "Steel rebar"
        assert body["quantity"] == 25.5
        assert body["unit"] == "kg"
        assert body["notes"] == "Grade 60, 12mm diameter"
        assert body["daily_log_id"] == log_id
        assert "id" in body

    def test_create_required_fields_only_sets_notes_to_null(self, seeded_client):
        log_id = seeded_client.log_id
        resp = seeded_client.post(
            f"/daily-logs/{log_id}/materials",
            json={"material_name": "Sand", "quantity": 5.0, "unit": "m³"},
        )
        assert resp.status_code == 201
        assert resp.json()["notes"] is None

    def test_quantity_stored_as_float(self, seeded_client):
        log_id = seeded_client.log_id
        resp = seeded_client.post(
            f"/daily-logs/{log_id}/materials",
            json={"material_name": "Gravel", "quantity": 3, "unit": "t"},
        )
        assert resp.status_code == 201
        assert isinstance(resp.json()["quantity"], float)

    def test_fractional_quantity_returned_correctly(self, seeded_client):
        log_id = seeded_client.log_id
        resp = seeded_client.post(
            f"/daily-logs/{log_id}/materials",
            json={"material_name": "Epoxy", "quantity": 0.75, "unit": "L"},
        )
        assert resp.status_code == 201
        assert resp.json()["quantity"] == 0.75

    def test_create_missing_material_name_returns_422(self, seeded_client):
        resp = seeded_client.post(
            f"/daily-logs/{seeded_client.log_id}/materials",
            json={"quantity": 5.0, "unit": "m³"},
        )
        assert resp.status_code == 422

    def test_create_missing_quantity_returns_422(self, seeded_client):
        resp = seeded_client.post(
            f"/daily-logs/{seeded_client.log_id}/materials",
            json={"material_name": "Sand", "unit": "m³"},
        )
        assert resp.status_code == 422

    def test_create_missing_unit_returns_422(self, seeded_client):
        resp = seeded_client.post(
            f"/daily-logs/{seeded_client.log_id}/materials",
            json={"material_name": "Sand", "quantity": 5.0},
        )
        assert resp.status_code == 422

    def test_create_non_numeric_quantity_returns_422(self, seeded_client):
        resp = seeded_client.post(
            f"/daily-logs/{seeded_client.log_id}/materials",
            json={"material_name": "Sand", "quantity": "lots", "unit": "m³"},
        )
        assert resp.status_code == 422

    def test_create_on_nonexistent_log_returns_404(self, client):
        resp = client.post(
            "/daily-logs/9999/materials",
            json={"material_name": "Sand", "quantity": 1.0, "unit": "m³"},
        )
        assert resp.status_code == 404

    def test_multiple_materials_accumulate(self, seeded_client):
        log_id = seeded_client.log_id
        _create_material(seeded_client, log_id, material_name="Concrete")
        _create_material(seeded_client, log_id, material_name="Steel")
        resp = seeded_client.get(f"/daily-logs/{log_id}/materials")
        assert len(resp.json()) == 2


# ---------------------------------------------------------------------------
# Delete material
# ---------------------------------------------------------------------------

class TestDeleteMaterial:
    def test_delete_existing_returns_204(self, seeded_client):
        log_id = seeded_client.log_id
        mat = _create_material(seeded_client, log_id)
        resp = seeded_client.delete(f"/daily-logs/{log_id}/materials/{mat['id']}")
        assert resp.status_code == 204

    def test_deleted_material_removed_from_list(self, seeded_client):
        log_id = seeded_client.log_id
        mat = _create_material(seeded_client, log_id)
        seeded_client.delete(f"/daily-logs/{log_id}/materials/{mat['id']}")
        resp = seeded_client.get(f"/daily-logs/{log_id}/materials")
        assert resp.json() == []

    def test_delete_nonexistent_returns_404(self, seeded_client):
        resp = seeded_client.delete(f"/daily-logs/{seeded_client.log_id}/materials/9999")
        assert resp.status_code == 404

    def test_delete_material_from_wrong_log_returns_404(self, seeded_client, SessionFactory):
        """A material belonging to log A cannot be deleted via log B's URL."""
        import datetime
        from app.models import DailyLog, Project

        session = SessionFactory()
        try:
            proj2 = Project(name="P2", location_city="Haifa", latitude=32.8, longitude=35.0)
            session.add(proj2)
            session.flush()
            log2 = DailyLog(project_id=proj2.id, date=datetime.date(2025, 1, 1))
            session.add(log2)
            session.commit()
            log2_id = log2.id
        finally:
            session.close()

        mat = _create_material(seeded_client, seeded_client.log_id)
        resp = seeded_client.delete(f"/daily-logs/{log2_id}/materials/{mat['id']}")
        # With auth, user is not a member of proj2 so they get 403 before the 404 check
        assert resp.status_code in (403, 404)
