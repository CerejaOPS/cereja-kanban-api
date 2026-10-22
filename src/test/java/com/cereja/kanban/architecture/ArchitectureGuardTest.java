package com.cereja.kanban.architecture;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.library.Architectures.layeredArchitecture;
import static com.tngtech.archunit.library.dependencies.SlicesRuleDefinition.slices;

@AnalyzeClasses(packages = "com.cereja.kanban", importOptions = ImportOption.DoNotIncludeTests.class)
public class ArchitectureGuardTest {

    @ArchTest
    public static final ArchRule no_circular_dependencies =
        slices().matching("com.cereja.kanban.(*)..")
        .should().beFreeOfCycles()
        .because("Dependências circulares entre pacotes não são permitidas.");

    @ArchTest
    public static final ArchRule domain_should_not_depend_on_frameworks =
        noClasses().that().resideInAPackage("..domain..")
        .should().dependOnClassesThat().resideInAnyPackage(
            "org.springframework..", "jakarta.persistence.."
        ).because("A camada de domínio deve ser livre de frameworks e infraestrutura.");

    @ArchTest
    public static final ArchRule controllers_should_not_access_repositories_directly =
        noClasses().that().resideInAPackage("..presentation..")
        .should().accessClassesThat().resideInAPackage("..infrastructure.database..")
        .because("Controllers devem acessar a camada de Aplicação/UseCases, não diretamente a Persistência.");

    @ArchTest
    public static final ArchRule layered_architecture_respects_clean_arch =
        layeredArchitecture()
            .consideringAllDependencies()
            .layer("Domain").definedBy("..domain..")
            .optionalLayer("UseCases").definedBy("..application..")
            .optionalLayer("Infrastructure").definedBy("..infrastructure..")
            .optionalLayer("Presentation").definedBy("..presentation..")
            .whereLayer("Domain").mayOnlyBeAccessedByLayers("UseCases", "Infrastructure", "Presentation")
            .whereLayer("UseCases").mayOnlyBeAccessedByLayers("Presentation", "Infrastructure");
}
