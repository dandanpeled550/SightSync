"""
Functional Tests: Safety Incidents (Feature 3)
Coverage:
  - List on non-existent log → 404
  - List on empty log → []
  - Create with all fields → 201
  - Create with required fields only → 201, optional fields null
  - Create missing required field → 422
  - Create on non-existent log → 404
  - Created incident appears in list
  - Delete existing → 204, removed from list
  - Delete non-existent → 404
"""

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_incident(client, log_id: int, **kwargs) -> dict:
    payload = {
        "incident_type": "Near Miss",
        "description": "Worker slipped on wet surface",
        **kwargs,
    }
    resp = client.post(f"/daily-logs/{log_id}/incidents", json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


# ---------------------------------------------------------------------------
# List incidents
# ---------------------------------------------------------------------------

class TestListIncidents:
    def test_nonexistent_log_returns_404(self, client):
        resp = client.get("/daily-logs/9999/incidents")
        assert resp.status_code == 404

    def test_empty_log_returns_empty_list(self, seeded_client):
        resp = seeded_client.get(f"/daily-logs/{seeded_client.log_id}/incidents")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_created_incident_appears_in_list(self, seeded_client):
        log_id = seeded_client.log_id
        _create_incident(seeded_client, log_id)
        resp = seeded_client.get(f"/daily-logs/{log_id}/incidents")
        assert resp.status_code == 200
        assert len(resp.json()) == 1


# ---------------------------------------------------------------------------
# Create incident
# ---------------------------------------------------------------------------

class TestCreateIncident:
    def test_create_with_all_fields_returns_201(self, seeded_client):
        log_id = seeded_client.log_id
        payload = {
            "incident_type": "Near Miss",
            "description": "Scaffold plank shifted underfoot",
            "people_involved": "Avi Cohen",
            "corrective_action": "All planks secured and inspected",
        }
        resp = seeded_client.post(f"/daily-logs/{log_id}/incidents", json=payload)
        assert resp.status_code == 201
        body = resp.json()
        assert body["incident_type"] == "Near Miss"
        assert body["description"] == "Scaffold plank shifted underfoot"
        assert body["people_involved"] == "Avi Cohen"
        assert body["corrective_action"] == "All planks secured and inspected"
        assert body["daily_log_id"] == log_id
        assert "id" in body

    def test_create_required_fields_only_sets_optionals_to_null(self, seeded_client):
        log_id = seeded_client.log_id
        resp = seeded_client.post(
            f"/daily-logs/{log_id}/incidents",
            json={"incident_type": "Slip", "description": "Wet floor"},
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["people_involved"] is None
        assert body["corrective_action"] is None

    def test_create_missing_description_returns_422(self, seeded_client):
        resp = seeded_client.post(
            f"/daily-logs/{seeded_client.log_id}/incidents",
            json={"incident_type": "Near Miss"},
        )
        assert resp.status_code == 422

    def test_create_missing_incident_type_returns_422(self, seeded_client):
        resp = seeded_client.post(
            f"/daily-logs/{seeded_client.log_id}/incidents",
            json={"description": "Something happened"},
        )
        assert resp.status_code == 422

    def test_create_on_nonexistent_log_returns_404(self, client):
        resp = client.post(
            "/daily-logs/9999/incidents",
            json={"incident_type": "Near Miss", "description": "desc"},
        )
        assert resp.status_code == 404

    def test_multiple_incidents_accumulate(self, seeded_client):
        log_id = seeded_client.log_id
        _create_incident(seeded_client, log_id, incident_type="Slip")
        _create_incident(seeded_client, log_id, incident_type="Fall")
        resp = seeded_client.get(f"/daily-logs/{log_id}/incidents")
        assert len(resp.json()) == 2


# ---------------------------------------------------------------------------
# Delete incident
# ---------------------------------------------------------------------------

class TestDeleteIncident:
    def test_delete_existing_returns_204(self, seeded_client):
        log_id = seeded_client.log_id
        inc = _create_incident(seeded_client, log_id)
        resp = seeded_client.delete(f"/daily-logs/{log_id}/incidents/{inc['id']}")
        assert resp.status_code == 204

    def test_deleted_incident_removed_from_list(self, seeded_client):
        log_id = seeded_client.log_id
        inc = _create_incident(seeded_client, log_id)
        seeded_client.delete(f"/daily-logs/{log_id}/incidents/{inc['id']}")
        resp = seeded_client.get(f"/daily-logs/{log_id}/incidents")
        assert resp.json() == []

    def test_delete_nonexistent_returns_404(self, seeded_client):
        resp = seeded_client.delete(f"/daily-logs/{seeded_client.log_id}/incidents/9999")
        assert resp.status_code == 404

    def test_delete_incident_from_wrong_log_returns_404(self, seeded_client, SessionFactory):
        """An incident belonging to log A cannot be deleted via log B's URL."""
        import datetime
        from app.models import DailyLog

        session = SessionFactory()
        try:
            from app.models import Project
            proj2 = Project(name="P2", location_city="Haifa", latitude=32.8, longitude=35.0)
            session.add(proj2)
            session.flush()
            log2 = DailyLog(project_id=proj2.id, date=datetime.date(2025, 1, 1))
            session.add(log2)
            session.commit()
            log2_id = log2.id
        finally:
            session.close()

        inc = _create_incident(seeded_client, seeded_client.log_id)
        resp = seeded_client.delete(f"/daily-logs/{log2_id}/incidents/{inc['id']}")
        # With auth, user is not a member of proj2 so they get 403 before the 404 check
        assert resp.status_code in (403, 404)
