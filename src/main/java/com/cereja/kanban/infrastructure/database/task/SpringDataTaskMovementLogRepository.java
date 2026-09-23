package com.cereja.kanban.infrastructure.database.task;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * Repositório Spring Data JPA para a entidade {@link TaskMovementLogEntity}.
 * O Spring gera automaticamente a implementação desta interface em tempo de execução,
 * provendo operações de CRUD e consultas no banco de dados PostgreSQL.
 */
@Repository
public interface SpringDataTaskMovementLogRepository extends JpaRepository<TaskMovementLogEntity, Long> {
}
