"""
Database Connection and Session Management Module.

Simulates database connectivity, connection pooling, and query execution.
"""

from typing import Dict, Any, Optional, List


class DatabaseConnection:
    """
    Manages database connection pool and query execution.
    """

    def __init__(self, host: str = "localhost", port: int = 5432, db_name: str = "coderag_db"):
        self.host = host
        self.port = port
        self.db_name = db_name
        self.is_connected = False
        self._mock_tables: Dict[str, List[Dict[str, Any]]] = {
            "users": [
                {
                    "id": 1,
                    "username": "alice",
                    "hashed_password": "hashed_secret_alice_pass",
                    "role": "admin",
                },
                {
                    "id": 2,
                    "username": "bob",
                    "hashed_password": "hashed_secret_bob_pass",
                    "role": "developer",
                },
            ]
        }

    def connect(self) -> bool:
        """
        Establish connection to the database instance.
        """
        self.is_connected = True
        return True

    def disconnect(self) -> None:
        """
        Close the active database connection.
        """
        self.is_connected = False

    def query(self, table: str, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """
        Execute a SELECT query against the specified table with optional key-value filters.
        """
        if not self.is_connected:
            raise ConnectionError("Database is not connected. Call connect() first.")

        records = self._mock_tables.get(table, [])
        if not filters:
            return records

        results = []
        for record in records:
            match = all(record.get(k) == v for k, v in filters.items())
            if match:
                results.append(record)
        return results

    def insert(self, table: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Insert a new record into the specified table.
        """
        if not self.is_connected:
            raise ConnectionError("Database is not connected. Call connect() first.")

        if table not in self._mock_tables:
            self._mock_tables[table] = []

        new_id = len(self._mock_tables[table]) + 1
        record = {"id": new_id, **data}
        self._mock_tables[table].append(record)
        return record


# Global database instance
db_instance = DatabaseConnection()


def get_db() -> DatabaseConnection:
    """
    Dependency provider that yields an active database connection.
    """
    if not db_instance.is_connected:
        db_instance.connect()
    return db_instance
