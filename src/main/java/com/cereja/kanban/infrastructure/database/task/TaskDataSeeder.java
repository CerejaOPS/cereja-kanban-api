package com.cereja.kanban.infrastructure.database.task;

import com.cereja.kanban.domain.Task.TaskPhase;
import com.cereja.kanban.domain.Task.TaskPriority;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

/**
 * Seeder para preencher o banco de dados H2 com uma tarefa de teste na inicialização,
 * garantindo o mesmo comportamento que o antigo InMemoryTaskRepository.
 */
@Component
public class TaskDataSeeder implements CommandLineRunner {

    private final SpringDataTaskRepository springDataRepository;

    public TaskDataSeeder(SpringDataTaskRepository springDataRepository) {
        this.springDataRepository = springDataRepository;
    }

    @Override
    public void run(String... args) throws Exception {
        // Se o banco estiver vazio, semeia uma tarefa inicial com ID 1
        if (springDataRepository.count() == 0) {
            TaskEntity testTask = new TaskEntity();
            testTask.setTitle("Tarefa Inicial de Teste");
            testTask.setDescription("Esta tarefa foi gerada automaticamente na inicialização da aplicação.");
            testTask.setPhase(TaskPhase.TODO);
            testTask.setPriority(TaskPriority.MEDIA);
            testTask.setBoardId(1L);
            
            springDataRepository.save(testTask);
            System.out.println(">>> [SEEDER] Banco de dados H2 populado com a tarefa padrão de ID: 1");
        }
    }
}
