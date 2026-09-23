package com.cereja.kanban.infrastructure.database.task;

import com.cereja.kanban.domain.Task.TaskPhase;
import com.cereja.kanban.domain.TaskMovementLog;
import com.cereja.kanban.domain.TaskMovementLogRepository;
import org.springframework.stereotype.Component;

/**
 * Adaptador que implementa o contrato de domínio {@link TaskMovementLogRepository}
 * utilizando Spring Data JPA como mecanismo de persistência real (PostgreSQL).
 *
 * <p>Responsabilidades:
 * <ul>
 *   <li>Converter o objeto de domínio {@link TaskMovementLog} para a entidade JPA {@link TaskMovementLogEntity}.</li>
 *   <li>Delegar a persistência ao {@link SpringDataTaskMovementLogRepository}.</li>
 * </ul>
 *
 * <p>Esta classe é o único ponto de contato entre a camada de domínio e o banco de dados
 * para os logs de movimentação, garantindo que o domínio permaneça livre de dependências de infraestrutura.
 */
@Component
public class LogRepositoryAdapter implements TaskMovementLogRepository {

    private final SpringDataTaskMovementLogRepository springDataRepository;

    public LogRepositoryAdapter(SpringDataTaskMovementLogRepository springDataRepository) {
        this.springDataRepository = springDataRepository;
    }

    /**
     * Persiste um registro de movimentação de tarefa no banco de dados.
     *
     * @param log Objeto de domínio contendo os dados da movimentação a ser salva.
     */
    @Override
    public void save(TaskMovementLog log) {
        // 1. Converte o objeto de domínio para a entidade JPA
        TaskMovementLogEntity entity = new TaskMovementLogEntity();
        entity.setTaskId(log.getTaskId());
        entity.setFaseAnterior(log.getFaseAnterior());
        entity.setFaseNova(log.getFaseNova());
        entity.setMovidoPor(log.getMovidoPor());
        entity.setMovidoEm(log.getMovidoEm());

        // 2. Persiste no banco via Spring Data JPA
        springDataRepository.save(entity);
    }
}
