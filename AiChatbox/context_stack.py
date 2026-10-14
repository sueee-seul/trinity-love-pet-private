"""
The "context stack" from Tropical_Chatbox_refined.docx, Section 3c / Section 4
Layer 1. This is conversation-scoped state. It is NOT the immutable
per-conversation scoping the original (v1) design used. Only user_id is fixed.
"""

from dataclasses import dataclass, field


@dataclass
class ContextStack:
    user_id: str
    referenced_entities: dict = field(default_factory=dict)   # name -> pet_id
    current_entity: dict = field(default_factory=lambda: {"pet": None, "booking_id": None, "stay": None})
    recent_topics: list = field(default_factory=list)          # [(pet, activity), ...], most recent last
    history: list = field(default_factory=list)                # [{"role": "user"/"assistant", "content": ...}]
    # A turn can span more than one message when the resolver needs to ask
    # a follow-up (which pet? which stay?). These hold what's already been
    # confirmed *this* turn so a later reply like "Max" or "current stay"
    # -- which restates only the missing piece -- doesn't lose the rest.
    pending_pet: str = None
    pending_activity: str = None

    def note_entity(self, pet, pet_id):
        self.referenced_entities[pet] = pet_id

    def set_current(self, pet, booking_id, stay):
        self.current_entity = {"pet": pet, "booking_id": booking_id, "stay": stay}

    def note_topic(self, pet, activity):
        self.recent_topics.append((pet, activity))
        self.recent_topics = self.recent_topics[-6:]  # keep it small, per Section 3c

    def add_turn(self, role, content):
        self.history.append({"role": role, "content": content})

    def as_prompt_block(self):
        """Render the stack the way Section 3c / Layer 1 in the doc show it."""
        lines = ["Fixed:", f"  user_id = {self.user_id}", ""]
        lines.append("Referenced entities (this conversation):")
        if self.referenced_entities:
            for name, pid in self.referenced_entities.items():
                lines.append(f"  {name} (pet_id = {pid})")
        else:
            lines.append("  (none yet)")
        lines.append("")
        lines.append("Current entity (most recently resolved):")
        ce = self.current_entity
        if ce["pet"]:
            lines.append(f"  pet = {ce['pet']}")
            lines.append(f"  booking_id = {ce['booking_id']}")
            lines.append(f"  stay = {ce['stay']}")
        else:
            lines.append("  (none yet)")
        lines.append("")
        lines.append("Recent topics:")
        if self.recent_topics:
            for pet, activity in self.recent_topics[-4:]:
                lines.append(f"  {pet} -> {activity}")
        else:
            lines.append("  (none yet)")
        return "\n".join(lines)
