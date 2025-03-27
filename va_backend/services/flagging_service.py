import json
import os
import uuid
from datetime import datetime

MANDATORY_LOG_FILE = "flagged_mandatory.json"
VOLUNTARY_LOG_FILE = "flagged_voluntary.json"

class FlaggingService:
    def __init__(self, mandatory_path=MANDATORY_LOG_FILE, voluntary_path=VOLUNTARY_LOG_FILE):
        self.paths = {
            "mandatory": mandatory_path,
            "voluntary": voluntary_path
        }
        for path in self.paths.values():
            if not os.path.exists(path):
                with open(path, "w") as f:
                    json.dump([], f)

    def _load_flags(self, flag_type):
        with open(self.paths[flag_type], "r") as f:
            return json.load(f)

    def _save_flags(self, flag_type, flags):
        with open(self.paths[flag_type], "w") as f:
            json.dump(flags, f, indent=2)

    def log_flagged_question(self, course_id, question, reason, flag_type="mandatory"):
        flags = self._load_flags(flag_type)
        new_flag = {
            "id": str(uuid.uuid4()),
            "course_id": course_id,
            "question": question,
            "reason": reason,
            "timestamp": datetime.now().isoformat(),
            "seen": False
        }
        flags.append(new_flag)
        self._save_flags(flag_type, flags)
        print(f"L42: 🚩 Logged [{flag_type.upper()}] flag:", new_flag)
        return new_flag

    def read_flagged_questions(self, course_id, flag_type="mandatory", include_seen=False):
        print(f"L42: Reading flags - course_id={course_id}, flag_type={flag_type}, include_seen={include_seen}")
        
        flags = self._load_flags(flag_type)
        print(f"L42: Loaded {len(flags)} flags of type '{flag_type}'")
    
        filtered = [
            f for f in flags
            if f["course_id"] == course_id and (include_seen or not f["seen"])
        ]
    
        print(f"L42: Returning {len(filtered)} matching flags")
        return filtered
    

    def mark_as_seen(self, flag_id, flag_type="mandatory"):
        flags = self._load_flags(flag_type)
        updated = False

        for f in flags:
            if f["id"] == flag_id:
                f["seen"] = True
                updated = True
                break

        if updated:
            self._save_flags(flag_type, flags)
            print(f"L42: ✅ Marked [{flag_type.upper()}] flag {flag_id} as seen.")
            return True
        else:
            print(f"L42: ⚠️ Flag ID {flag_id} not found.")
            return False
