from typing import List, Optional

from app.modules.matching import haversine_distance
from app.schemas import DemoHospital, Location

# Fictional coordinates exist only to demonstrate distance sorting, not real hospital locations.
DEMO_HOSPITALS = [
    ("demo-central", "Demo Central Emergency Hospital", "Fictional Delhi demo location", 28.54, 77.27),
    ("demo-community", "Demo Community Hospital", "Fictional South Delhi demo location", 28.51, 77.21),
    ("demo-city", "Demo City Medical Centre", "Fictional East Delhi demo location", 28.61, 77.30),
]

def list_demo_hospitals(location: Optional[Location]) -> List[DemoHospital]:
    hospitals = [
        DemoHospital(
            hospital_id=identifier, name=name, area=area,
            distance_km=round(haversine_distance(location.lat, location.lng, lat, lng), 1) if location else None,
        )
        for identifier, name, area, lat, lng in DEMO_HOSPITALS
    ]
    if location:
        hospitals.sort(key=lambda hospital: hospital.distance_km)
    return hospitals
