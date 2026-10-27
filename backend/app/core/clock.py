"""Time helpers. Everything is stored in UTC; session dates/times and working hours are in IST."""

from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from app.config import get_settings

UTC = timezone.utc


def tz() -> ZoneInfo:
    return ZoneInfo(get_settings().business_timezone)


def now() -> datetime:
    return datetime.now(UTC)


def iso(dt: datetime) -> str:
    """ISO 8601 in UTC with a Z suffix and milliseconds, like JavaScript's toISOString()."""
    return dt.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


def now_iso() -> str:
    return iso(now())


def local_now() -> datetime:
    return now().astimezone(tz())


def today() -> date:
    return local_now().date()


def today_iso() -> str:
    return today().isoformat()


def local_dt(d: str, hhmm: str) -> datetime:
    """A business-time date + HH:MM as an aware datetime."""
    y, m, dd = (int(x) for x in d.split("-"))
    h, mi = (int(x) for x in hhmm.split(":"))
    return datetime(y, m, dd, h, mi, tzinfo=tz())


def to_minutes(hhmm: str) -> int:
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def from_minutes(mins: int) -> str:
    return f"{mins // 60:02d}:{mins % 60:02d}"


def add_days_iso(n: int, base: date | None = None) -> str:
    return ((base or today()) + timedelta(days=n)).isoformat()


def add_working_hours(start: datetime, hours: float) -> datetime:
    """Adds working time (Mon–Sat, 10:00–19:00 business time) to a moment."""
    remaining = timedelta(hours=hours)
    t = start.astimezone(tz())
    while remaining > timedelta(0):
        day_start = t.replace(hour=10, minute=0, second=0, microsecond=0)
        day_end = t.replace(hour=19, minute=0, second=0, microsecond=0)
        if t.weekday() == 6 or t >= day_end:  # Sunday, or after hours: next working morning
            t = (t + timedelta(days=1)).replace(hour=10, minute=0, second=0, microsecond=0)
            continue
        if t < day_start:
            t = day_start
        available = day_end - t
        if remaining <= available:
            return (t + remaining).astimezone(UTC)
        remaining -= available
        t = day_end
    return t.astimezone(UTC)
