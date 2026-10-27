"""Calendar invitations (.ics) attached to session emails, so sessions land in Google Calendar, Outlook, etc."""

from datetime import datetime

from icalendar import Calendar, Event, vCalAddress, vText

from app.config import get_settings
from app.core.clock import UTC, now
from app.services.scheduling import session_times


def format_date(d: str) -> str:
    """'2026-10-24' → '24 Oct 2026' (the frontend's date format)."""
    x = datetime.fromisoformat(d)
    return f"{x.day} {x.strftime('%b')} {x.year}"


def session_ics(session: dict, student: dict, counsellor: dict, *, cancel: bool = False, sequence: int = 0) -> dict:
    start, end = session_times(session["date"], session["time"], session["durationMinutes"])
    cal = Calendar()
    cal.add("prodid", "-//AHat//Student Portal//EN")
    cal.add("version", "2.0")
    cal.add("method", "CANCEL" if cancel else "REQUEST")
    ev = Event()
    ev.add("uid", f"session-{session['_id']}@ahat")
    ev.add("dtstamp", now().astimezone(UTC))
    ev.add("dtstart", start.astimezone(UTC))
    ev.add("dtend", end.astimezone(UTC))
    ev.add("sequence", sequence)
    ev.add("summary", f"AHat: {session['type']} ({student['name']} with {counsellor['name']})")
    online = session["mode"] == "online"
    link = get_settings().meeting_link
    ev.add("location", link if online and link else "AHat office")
    ev.add("description", f"{session['type']} session.\n" + (f"Join online: {link}" if online and link else "At the AHat office."))
    ev.add("status", "CANCELLED" if cancel else "CONFIRMED")
    organizer = vCalAddress(f"mailto:{counsellor['email']}")
    organizer.params["cn"] = vText(counsellor["name"])
    ev["organizer"] = organizer
    for person in (student, counsellor):
        a = vCalAddress(f"mailto:{person['email']}")
        a.params["cn"] = vText(person["name"])
        a.params["role"] = vText("REQ-PARTICIPANT")
        ev.add("attendee", a, encode=0)
    cal.add_component(ev)
    return {"filename": "invite.ics", "contentType": "text/calendar", "content": cal.to_ical().decode()}
