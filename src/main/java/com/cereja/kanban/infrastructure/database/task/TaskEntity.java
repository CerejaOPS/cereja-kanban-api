package com.cereja.kanban.infrastructure.database.task;

import com.cereja.kanban.domain.Board.Board;
import com.cereja.kanban.domain.Task.TaskPhase;
import com.cereja.kanban.domain.Task.TaskPriority;
import jakarta.persistence.*; // Importe tudo do JPA
import jdk.jfr.Relational;
import lombok.*;

@Entity // 1. Diz pro Spring: "Isso aqui é uma tabela no banco!"
@Table(name = "tasks") // 2. Dá o nome plural para a tabela
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class TaskEntity {

    @Id // 3. Diz que esse campo é a Chave Primária (PK)
    @GeneratedValue(strategy = GenerationType.IDENTITY) // 4. Faz o ID ser Auto Increment (1, 2, 3...)
    private Long id;

    @Column(nullable = false, length = 100) // 5. Regras da coluna: não pode ser nulo, máx 100 caracteres
    private String title;

    @Column(columnDefinition = "TEXT") // Permite textos longos
    private String description;

    @Enumerated(EnumType.STRING) // Obriga o JPA a salvar a palavra "ALTA", e não o número 2.
    @Column(nullable = false)
    private TaskPriority priority;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TaskPhase phase;

    @Column(name = "board_id", nullable = false)
    private Long boardId;

    @Column(name = "assignee_discord_id")
    private String assigneeDiscordId;

    @org.hibernate.annotations.CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private java.time.LocalDateTime createdAt;

    @org.hibernate.annotations.UpdateTimestamp
    @Column(name = "updated_at")
    private java.time.LocalDateTime updatedAt;
}