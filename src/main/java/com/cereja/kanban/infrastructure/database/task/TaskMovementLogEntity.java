package com.cereja.kanban.infrastructure.database.task;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

import com.cereja.kanban.domain.Task.TaskPhase;

/**
 * Entidade JPA que representa a tabela de log de movimentação de tarefas no
 * banco de dados.
 * Cada registro representa uma transição de fase de uma tarefa específica.
 */
@Entity
@Table(name = "task_movement_logs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class TaskMovementLogEntity {

    /** Identificador único do log (gerado automaticamente pelo banco). */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** ID da tarefa que foi movida. */
    @Column(name = "task_id", nullable = false)
    private Long taskId;

    /** Nome da fase de origem antes da movimentação. */
    @Enumerated(EnumType.STRING)
    @Column(name = "fase_anterior", nullable = false, length = 50)
    private TaskPhase faseAnterior;

    /** Nome da fase de destino após a movimentação. */
    @Enumerated(EnumType.STRING)
    @Column(name = "fase_nova", nullable = false, length = 50)
    private TaskPhase faseNova;

    /** Identificador de quem acionou a movimentação (ex: Discord ID ou nome). */
    @Column(name = "movido_por", length = 100)
    private String movidoPor;

    /** Timestamp exato da movimentação. */
    @Column(name = "movido_em", nullable = false)
    private LocalDateTime movidoEm;
}
