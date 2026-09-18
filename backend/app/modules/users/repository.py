from __future__ import annotations

from app.modules.users.models import User
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    model = User

    async def get_by_telegram_id(self, telegram_id: int) -> User | None:
        return await self.find_one_by(telegram_id=telegram_id)
