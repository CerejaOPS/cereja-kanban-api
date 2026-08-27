package com.cereja.kanban.application.Task;

import com.cereja.kanban.domain.Task.ITaskRepository;
import com.cereja.kanban.domain.Task.Task;
import com.cereja.kanban.domain.Task.TaskPhase;
import org.springframework.stereotype.Service;

import java.util.List;

@Service // Essencial! Diz pro Spring que essa classe é um Service
public class TaskService {

    // O Service só conversa com a interface pura do domínio!
    private final ITaskRepository taskRepository;

    // Construtor (o Spring injeta aquele Adapter que você criou aqui dentro sozinho!)
    public TaskService(ITaskRepository taskRepository) {
        this.taskRepository = taskRepository;
    }

    // 1. Criar Task
    public Task createTask(Task novaTask) {
        // Regra de Negócio: Toda task nova deve nascer obrigatoriamente na fase BACKLOG
        novaTask.setPhase(TaskPhase.BACKLOG);

        // Mande salvar e retorne o resultado
        return taskRepository.save(novaTask);
    }

    // TODO: Agora é com você! Implemente esses dois métodos:

    // 2. Listar Todas
    public List<Task> findAll() {
        return taskRepository.findAll();
    }

    // 3. Buscar por ID (Com regra de negócio de "Não Encontrado")
    public Task findById(Long id) {
        return taskRepository.findById(id).orElseThrow(() -> new RuntimeException("Task não encontrada ou não existe"));
    }

    public Task update(Long id, Task dadosAtualizados) {
        // 1. Busca a task que JÁ EXISTE no banco (a caixa velha)
        Task taskExistente = findById(id); // Reusa o método que você já criou!

        // 2. Copia os dados novos para dentro da task existente
        taskExistente.setTitle(dadosAtualizados.getTitle());
        taskExistente.setDescription(dadosAtualizados.getDescription());
        taskExistente.setPriority(dadosAtualizados.getPriority());
        // Obs: NÃO atualizamos a Phase aqui (mover de fase é a FEAT-02, com regras próprias)

        // 3. Salva de volta no banco e retorna
        return taskRepository.save(taskExistente);
    }

    public void deleteTask(Long id){
        findById(id);

        taskRepository.deleteById(id);
        }
    }
